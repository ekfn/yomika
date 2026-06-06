import type { RunnerState } from "@/library/library-status-values";

export const RUNNER_TASK_TYPES = [
  "BOOK_IMPORT",
  "OCR",
  "CLEAN_UP",
  "SPLIT",
  "TRANSLATION",
  "VOCABULARY",
] as const;

export type RunnerTaskType = (typeof RUNNER_TASK_TYPES)[number];

export type RunnerTask = {
  type: RunnerTaskType;
  bookPath: string | null;
  pagePath: string | null;
  label: string;
};

export type RunnerLastError = {
  message: string;
  occurredAt: string;
  task: RunnerTask | null;
};

export type RunnerOperationLogParams = {
  bookPath: string | null;
  pagePath: string | null;
  label: string;
};

export type RunnerOperationLogResult = {
  status: "success" | "error" | "skipped";
  durationMs: number;
  message?: string;
};

export type RunnerOperationLogEntry =
  | {
      ts: string;
      phase: "start";
      runId: string;
      operation: RunnerTaskType;
      params: RunnerOperationLogParams;
      result?: null;
    }
  | {
      ts: string;
      phase: "finish";
      runId: string;
      operation: RunnerTaskType;
      params?: null;
      result: RunnerOperationLogResult;
      model?: null;
    }
  | {
      ts: string;
      phase: "ai_request";
      runId: string;
      operation: RunnerTaskType;
      model: string;
      params?: null;
      result?: null;
    };

export type RunnerStatus = {
  state: RunnerState;
  runId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  currentTask: RunnerTask | null;
  processedTaskCount: number;
  skippedTaskCount: number;
  stopRequested: boolean;
  lastError: RunnerLastError | null;
  lastMessage: string | null;
  exhaustedModelIds: string[];
};

export const IDLE_RUNNER_STATUS: RunnerStatus = {
  state: "IDLE",
  runId: null,
  startedAt: null,
  finishedAt: null,
  currentTask: null,
  processedTaskCount: 0,
  skippedTaskCount: 0,
  stopRequested: false,
  lastError: null,
  lastMessage: null,
  exhaustedModelIds: [],
};
