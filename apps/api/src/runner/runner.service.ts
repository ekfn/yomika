import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { AiModelRunStateService } from "@/ai/generation/ai-model-run-state.service";
import { isAiOperationModelsExhaustedError } from "@/ai/generation/ai-operation-models-exhausted.error";
import { AiRequestLogContextService } from "@/ai/generation/ai-request-log-context.service";
import { BookImportTaskHandler } from "./handlers/book-import-task.handler";
import { CleanupTaskHandler } from "./handlers/cleanup-task.handler";
import { OcrTaskHandler } from "./handlers/ocr-task.handler";
import { SplitTaskHandler } from "./handlers/split-task.handler";
import { TranslationTaskHandler } from "./handlers/translation-task.handler";
import { VocabularyTaskHandler } from "./handlers/vocabulary-task.handler";
import { RunnerStateService } from "./runner-state.service";
import { RunnerOperationLogService } from "./runner-operation-log.service";
import { RunnerTaskFinderService } from "./runner-task-finder.service";
import { RunnerTaskStateService } from "./runner-task-state.service";
import type { RunnerStatus, RunnerTask } from "./runner-types";

const AI_PROCESSING_RUNNER_TASK_TYPES = new Set<RunnerTask["type"]>([
  "CLEAN_UP",
  "SPLIT",
  "TRANSLATION",
  "VOCABULARY",
]);

@Injectable()
export class RunnerService {
  constructor(
    private readonly aiModelRunState: AiModelRunStateService,
    private readonly aiRequestLogContext: AiRequestLogContextService,
    private readonly bookImportTaskHandler: BookImportTaskHandler,
    private readonly cleanupTaskHandler: CleanupTaskHandler,
    private readonly ocrTaskHandler: OcrTaskHandler,
    private readonly runnerOperationLog: RunnerOperationLogService,
    private readonly runnerState: RunnerStateService,
    private readonly runnerTaskFinder: RunnerTaskFinderService,
    private readonly runnerTaskState: RunnerTaskStateService,
    private readonly splitTaskHandler: SplitTaskHandler,
    private readonly translationTaskHandler: TranslationTaskHandler,
    private readonly vocabularyTaskHandler: VocabularyTaskHandler,
  ) {}

  getStatus(): RunnerStatus {
    return this.withAiRunState(this.runnerState.getStatus());
  }

  async start(): Promise<RunnerStatus> {
    if (this.runnerState.isRunning()) {
      return this.getStatus();
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    this.aiModelRunState.reset();
    const status = await this.runnerState.markRunning(runId, startedAt);

    void this.run(runId);

    return this.withAiRunState(status);
  }

  async requestStopAfterCurrentTask(): Promise<RunnerStatus> {
    return this.withAiRunState(
      await this.runnerState.requestStopAfterCurrentTask(),
    );
  }

  async buildTaskQueue(): Promise<RunnerTask[]> {
    return this.runnerTaskFinder.buildTaskQueue();
  }

  private async run(runId: string): Promise<void> {
    let taskQueue: RunnerTask[] = [];

    try {
      while (this.runnerState.isRunning()) {
        if (this.runnerState.isStopRequested()) {
          await this.runnerState.markIdle(
            "Stop requested. Runner stopped before starting another task.",
          );
          return;
        }

        if (taskQueue.length === 0) {
          taskQueue = await this.buildTaskQueue();
        }

        const task = taskQueue.shift();

        if (!task) {
          await this.runnerState.markIdle("No eligible tasks remain.");
          return;
        }

        if (this.runnerState.isStopRequested()) {
          await this.runnerState.markIdle(
            "Stop requested. Runner stopped before starting another task.",
          );
          return;
        }

        await this.runnerState.markTask(task);
        try {
          await this.runLoggedTask(runId, task);
          await this.runnerState.markTaskComplete();
        } catch (error) {
          if (!isAiOperationModelsExhaustedError(error)) {
            throw error;
          }

          await this.runnerTaskState.returnTaskToPending(task);
          const skippedQueuedTaskCount = taskQueue.filter(
            (queuedTask) => queuedTask.type === task.type,
          ).length;
          taskQueue = taskQueue.filter(
            (queuedTask) => queuedTask.type !== task.type,
          );
          await this.runnerState.markTaskSkipped({
            message: error.message,
            skippedTaskCount: skippedQueuedTaskCount + 1,
          });
          continue;
        }

        if (this.runnerState.isStopRequested()) {
          await this.runnerState.markIdle(
            "Stop requested. Runner stopped after the current task.",
          );
          return;
        }

        taskQueue = await this.prependNextAiProcessingTaskForPage(
          taskQueue,
          task,
        );
      }
    } catch (error) {
      const status = this.runnerState.getStatus();
      const message = error instanceof Error ? error.message : String(error);
      await this.runnerTaskState.returnTaskToPending(status.currentTask);
      await this.runnerState.markStoppedAfterError({ message });
    }
  }

  private async runLoggedTask(runId: string, task: RunnerTask): Promise<void> {
    const startedAt = new Date();

    await this.runnerOperationLog.writeStart(runId, task, startedAt);

    try {
      await this.aiRequestLogContext.run(
        {
          recordAiRequest: (model) =>
            this.runnerOperationLog.writeAiRequest({
              runId,
              task,
              model,
              requestedAt: new Date(),
            }),
        },
        () => this.runTask(task),
      );
      await this.runnerOperationLog.writeFinishSuccess({
        runId,
        task,
        startedAt,
        finishedAt: new Date(),
      });
    } catch (error) {
      if (isAiOperationModelsExhaustedError(error)) {
        await this.runnerOperationLog.writeFinishSkipped({
          runId,
          task,
          startedAt,
          finishedAt: new Date(),
          message: error.message,
        });
        throw error;
      }

      await this.runnerOperationLog.writeFinishError({
        runId,
        task,
        startedAt,
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async prependNextAiProcessingTaskForPage(
    taskQueue: RunnerTask[],
    completedTask: RunnerTask,
  ): Promise<RunnerTask[]> {
    if (
      !completedTask.pagePath ||
      !AI_PROCESSING_RUNNER_TASK_TYPES.has(completedTask.type)
    ) {
      return taskQueue;
    }

    const nextTask =
      await this.runnerTaskFinder.findNextAiProcessingTaskForPage(
        completedTask.pagePath,
      );

    if (!nextTask) {
      return taskQueue;
    }

    return [
      nextTask,
      ...taskQueue.filter(
        (queuedTask) =>
          queuedTask.pagePath !== nextTask.pagePath ||
          queuedTask.type !== nextTask.type,
      ),
    ];
  }

  private runTask(task: RunnerTask): Promise<void> {
    switch (task.type) {
      case "BOOK_IMPORT":
        return this.bookImportTaskHandler.run(task);
      case "OCR":
        return this.ocrTaskHandler.run(task);
      case "CLEAN_UP":
        return this.cleanupTaskHandler.run(task);
      case "SPLIT":
        return this.splitTaskHandler.run(task);
      case "TRANSLATION":
        return this.translationTaskHandler.run(task);
      case "VOCABULARY":
        return this.vocabularyTaskHandler.run(task);
    }
  }

  private withAiRunState(status: RunnerStatus): RunnerStatus {
    return {
      ...status,
      exhaustedModelIds: this.aiModelRunState.getExhaustedModelIds(),
    };
  }
}
