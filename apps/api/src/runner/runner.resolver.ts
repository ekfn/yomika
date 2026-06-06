import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@/auth/auth.guard";
import { RunnerOperationLogService } from "./runner-operation-log.service";
import { RunnerService } from "./runner.service";
import type {
  RunnerLastError,
  RunnerOperationLogEntry,
  RunnerStatus,
  RunnerTask,
} from "./runner-types";

type RunnerLastErrorOutput = Omit<RunnerLastError, "occurredAt"> & {
  occurredAt: Date;
};

type RunnerStatusOutput = Omit<
  RunnerStatus,
  "currentTask" | "finishedAt" | "lastError" | "startedAt"
> & {
  startedAt: Date | null;
  finishedAt: Date | null;
  currentTask: RunnerTask | null;
  lastError: RunnerLastErrorOutput | null;
};

type RunnerOperationLogEntryOutput = Omit<
  RunnerOperationLogEntry,
  "model" | "ts"
> & {
  ts: Date;
  model: string | null;
};

@Resolver()
@UseGuards(AuthGuard)
export class RunnerResolver {
  constructor(
    private readonly operationLog: RunnerOperationLogService,
    private readonly runnerService: RunnerService,
  ) {}

  @Query("runnerStatus")
  runnerStatus(): RunnerStatusOutput {
    return toRunnerStatusOutput(this.runnerService.getStatus());
  }

  @Query("runnerOperationLog")
  async runnerOperationLog(
    @Args("limit", { nullable: true }) limit?: number | null,
  ): Promise<RunnerOperationLogEntryOutput[]> {
    return (await this.operationLog.readEntries(limit)).map(
      toRunnerOperationLogEntryOutput,
    );
  }

  @Mutation("startRunner")
  async startRunner(): Promise<RunnerStatusOutput> {
    return toRunnerStatusOutput(await this.runnerService.start());
  }

  @Mutation("requestRunnerStop")
  async requestRunnerStop(): Promise<RunnerStatusOutput> {
    return toRunnerStatusOutput(
      await this.runnerService.requestStopAfterCurrentTask(),
    );
  }
}

function toRunnerStatusOutput(status: RunnerStatus): RunnerStatusOutput {
  return {
    ...status,
    startedAt: status.startedAt ? new Date(status.startedAt) : null,
    finishedAt: status.finishedAt ? new Date(status.finishedAt) : null,
    lastError: status.lastError
      ? {
          ...status.lastError,
          occurredAt: new Date(status.lastError.occurredAt),
        }
      : null,
  };
}

function toRunnerOperationLogEntryOutput(
  entry: RunnerOperationLogEntry,
): RunnerOperationLogEntryOutput {
  return {
    ...entry,
    ts: new Date(entry.ts),
    model: entry.phase === "ai_request" ? entry.model : null,
  };
}
