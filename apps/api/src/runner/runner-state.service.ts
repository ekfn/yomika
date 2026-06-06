import { Injectable } from "@nestjs/common";
import {
  IDLE_RUNNER_STATUS,
  type RunnerStatus,
  type RunnerTask,
} from "./runner-types";

@Injectable()
export class RunnerStateService {
  private status: RunnerStatus = IDLE_RUNNER_STATUS;

  getStatus(): RunnerStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.status.state === "RUNNING";
  }

  isStopRequested(): boolean {
    return this.status.stopRequested;
  }

  async markRunning(runId: string, startedAt: string): Promise<RunnerStatus> {
    return this.updateStatus({
      state: "RUNNING",
      runId,
      startedAt,
      finishedAt: null,
      currentTask: null,
      processedTaskCount: 0,
      skippedTaskCount: 0,
      stopRequested: false,
      lastError: null,
      lastMessage: "Runner started.",
      exhaustedModelIds: [],
    });
  }

  async requestStopAfterCurrentTask(): Promise<RunnerStatus> {
    if (!this.isRunning() || this.status.stopRequested) {
      return this.status;
    }

    return this.updateStatus({
      ...this.status,
      stopRequested: true,
      lastMessage: this.status.currentTask
        ? "Stop requested. Runner will stop after the current task."
        : "Stop requested. Runner will stop before starting another task.",
    });
  }

  async markTask(currentTask: RunnerTask): Promise<RunnerStatus> {
    return this.updateStatus({
      ...this.status,
      currentTask,
      lastMessage: currentTask.label,
    });
  }

  async markTaskComplete(): Promise<RunnerStatus> {
    return this.updateStatus({
      ...this.status,
      processedTaskCount: this.status.processedTaskCount + 1,
    });
  }

  async markTaskSkipped(input: {
    message: string;
    skippedTaskCount: number;
  }): Promise<RunnerStatus> {
    return this.updateStatus({
      ...this.status,
      currentTask: null,
      skippedTaskCount: this.status.skippedTaskCount + input.skippedTaskCount,
      lastMessage: input.message,
    });
  }

  async markIdle(message: string): Promise<RunnerStatus> {
    const hasSkippedTasks = this.status.skippedTaskCount > 0;

    return this.updateStatus({
      ...this.status,
      state: hasSkippedTasks ? "IDLE_WITH_SKIPPED_TASKS" : "IDLE",
      finishedAt: new Date().toISOString(),
      currentTask: null,
      stopRequested: false,
      lastMessage: hasSkippedTasks
        ? `${message} Skipped ${this.status.skippedTaskCount} tasks.`
        : message,
    });
  }

  async markStoppedAfterError(input: {
    message: string;
  }): Promise<RunnerStatus> {
    return this.updateStatus({
      ...this.status,
      state: "STOPPED_AFTER_ERROR",
      finishedAt: new Date().toISOString(),
      currentTask: null,
      stopRequested: false,
      lastError: {
        message: input.message,
        occurredAt: new Date().toISOString(),
        task: this.status.currentTask,
      },
      lastMessage: input.message,
    });
  }

  private updateStatus(status: RunnerStatus): RunnerStatus {
    this.status = status;
    return this.status;
  }
}
