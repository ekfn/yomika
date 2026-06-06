import { appendFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { LibraryPathsService } from "@/library/library-paths.service";
import {
  RUNNER_TASK_TYPES,
  type RunnerOperationLogEntry,
  type RunnerTask,
} from "./runner-types";

const MAX_OPERATION_LOG_BYTES = 100 * 1024;
const DEFAULT_OPERATION_LOG_LIMIT = 200;
const MAX_OPERATION_LOG_LIMIT = 500;

const runnerTaskTypeSchema = z.enum(RUNNER_TASK_TYPES);

const runnerOperationLogEntrySchema = z.union([
  z.object({
    ts: z.string().datetime(),
    phase: z.literal("start"),
    runId: z.string().min(1),
    operation: runnerTaskTypeSchema,
    params: z.object({
      bookPath: z.string().min(1).nullable(),
      pagePath: z.string().min(1).nullable(),
      label: z.string().min(1),
    }),
    result: z.null().optional(),
  }),
  z.object({
    ts: z.string().datetime(),
    phase: z.literal("finish"),
    runId: z.string().min(1),
    operation: runnerTaskTypeSchema,
    params: z.null().optional(),
    result: z.object({
      status: z.enum(["success", "error", "skipped"]),
      durationMs: z.number().int().nonnegative(),
      message: z.string().min(1).optional(),
    }),
    model: z.null().optional(),
  }),
  z.object({
    ts: z.string().datetime(),
    phase: z.literal("ai_request"),
    runId: z.string().min(1),
    operation: runnerTaskTypeSchema,
    params: z.null().optional(),
    result: z.null().optional(),
    model: z.string().min(1),
  }),
]);

type ParsedRunnerOperationLogEntry = z.infer<
  typeof runnerOperationLogEntrySchema
>;

@Injectable()
export class RunnerOperationLogService {
  private readonly logger = new Logger(RunnerOperationLogService.name);

  constructor(private readonly paths: LibraryPathsService) {}

  writeStart(runId: string, task: RunnerTask, startedAt: Date): Promise<void> {
    return this.writeRecordSafely({
      ts: startedAt.toISOString(),
      phase: "start",
      runId,
      operation: task.type,
      params: {
        bookPath: task.bookPath,
        pagePath: task.pagePath,
        label: task.label,
      },
    });
  }

  writeFinishSuccess(input: {
    runId: string;
    task: RunnerTask;
    startedAt: Date;
    finishedAt: Date;
  }): Promise<void> {
    return this.writeRecordSafely({
      ts: input.finishedAt.toISOString(),
      phase: "finish",
      runId: input.runId,
      operation: input.task.type,
      result: {
        status: "success",
        durationMs: getDurationMs(input.startedAt, input.finishedAt),
      },
    });
  }

  writeFinishError(input: {
    runId: string;
    task: RunnerTask;
    startedAt: Date;
    finishedAt: Date;
    message: string;
  }): Promise<void> {
    return this.writeRecordSafely({
      ts: input.finishedAt.toISOString(),
      phase: "finish",
      runId: input.runId,
      operation: input.task.type,
      result: {
        status: "error",
        durationMs: getDurationMs(input.startedAt, input.finishedAt),
        message: input.message,
      },
    });
  }

  writeFinishSkipped(input: {
    runId: string;
    task: RunnerTask;
    startedAt: Date;
    finishedAt: Date;
    message: string;
  }): Promise<void> {
    return this.writeRecordSafely({
      ts: input.finishedAt.toISOString(),
      phase: "finish",
      runId: input.runId,
      operation: input.task.type,
      result: {
        status: "skipped",
        durationMs: getDurationMs(input.startedAt, input.finishedAt),
        message: input.message,
      },
    });
  }

  writeAiRequest(input: {
    runId: string;
    task: RunnerTask;
    model: string;
    requestedAt: Date;
  }): Promise<void> {
    return this.writeRecordSafely({
      ts: input.requestedAt.toISOString(),
      phase: "ai_request",
      runId: input.runId,
      operation: input.task.type,
      model: input.model,
    });
  }

  async readEntries(limit?: number | null): Promise<RunnerOperationLogEntry[]> {
    const normalizedLimit = normalizeLimit(limit);
    const entries = [
      ...(await this.readLogFile(
        this.paths.getRunnerPreviousOperationLogPath(),
      )),
      ...(await this.readLogFile(this.paths.getRunnerOperationLogPath())),
    ];

    return entries.slice(-normalizedLimit);
  }

  private async writeRecordSafely(
    record: RunnerOperationLogEntry,
  ): Promise<void> {
    try {
      await this.rotateIfNeeded();
      await mkdir(dirname(this.paths.getRunnerOperationLogPath()), {
        recursive: true,
      });
      await appendFile(
        this.paths.getRunnerOperationLogPath(),
        `${JSON.stringify(record)}\n`,
        "utf8",
      );
    } catch (error) {
      this.logger.warn(
        `Runner operation log write failed: ${getErrorMessage(error)}`,
      );
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    const operationLogPath = this.paths.getRunnerOperationLogPath();

    try {
      const currentLog = await stat(operationLogPath);

      if (currentLog.size <= MAX_OPERATION_LOG_BYTES) {
        return;
      }

      await mkdir(dirname(operationLogPath), { recursive: true });
      await rename(
        operationLogPath,
        this.paths.getRunnerPreviousOperationLogPath(),
      );
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }

      throw error;
    }
  }

  private async readLogFile(path: string): Promise<RunnerOperationLogEntry[]> {
    let content: string;

    try {
      content = await readFile(path, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }

      throw error;
    }

    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .flatMap((line) => parseOperationLogLine(line));
  }
}

function getDurationMs(startedAt: Date, finishedAt: Date): number {
  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}

function normalizeLimit(limit: number | null | undefined): number {
  if (!Number.isInteger(limit) || !limit || limit < 1) {
    return DEFAULT_OPERATION_LOG_LIMIT;
  }

  return Math.min(limit, MAX_OPERATION_LOG_LIMIT);
}

function parseOperationLogLine(line: string): RunnerOperationLogEntry[] {
  try {
    const parsed = runnerOperationLogEntrySchema.safeParse(JSON.parse(line));
    return parsed.success ? [toRunnerOperationLogEntry(parsed.data)] : [];
  } catch {
    return [];
  }
}

function toRunnerOperationLogEntry(
  entry: ParsedRunnerOperationLogEntry,
): RunnerOperationLogEntry {
  if (entry.phase === "start") {
    return {
      ts: entry.ts,
      phase: entry.phase,
      runId: entry.runId,
      operation: entry.operation,
      params: entry.params,
    };
  }

  if (entry.phase === "ai_request") {
    return {
      ts: entry.ts,
      phase: entry.phase,
      runId: entry.runId,
      operation: entry.operation,
      model: entry.model,
    };
  }

  const { durationMs, message, status } = entry.result;

  return {
    ts: entry.ts,
    phase: entry.phase,
    runId: entry.runId,
    operation: entry.operation,
    result: message ? { status, durationMs, message } : { status, durationMs },
  };
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
