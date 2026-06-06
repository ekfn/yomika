import { AlertTriangle } from "lucide-react";
import {
  RunnerState,
  type RunnerStatusFieldsFragment,
} from "@/graphql/generated/graphql";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";

type RunnerStatusTabContentProps = {
  status: RunnerStatusFieldsFragment | null;
};

export function RunnerStatusTabContent({
  status,
}: RunnerStatusTabContentProps) {
  const currentTask = status?.currentTask ?? null;
  const lastError = status?.lastError ?? null;
  const exhaustedModelIds = status?.exhaustedModelIds ?? [];

  return (
    <TabsContent value="status" className="grid gap-5">
      {lastError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Last error</AlertTitle>
          <AlertDescription className="grid gap-1">
            <span className="font-medium">{lastError.message}</span>
            <span>
              {[
                formatMaybeDate(lastError.occurredAt),
                lastError.task?.label,
                lastError.task?.bookPath
                  ? `book: ${lastError.task.bookPath}`
                  : null,
                lastError.task?.pagePath
                  ? `page: ${lastError.task.pagePath}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {exhaustedModelIds.length > 0 ? (
        <Alert className="border-amber-200 bg-amber-50/70 text-amber-950">
          <AlertTriangle />
          <AlertTitle>Exhausted models</AlertTitle>
          <AlertDescription className="grid gap-2">
            <span>
              These models returned rate limit errors during this run. You can
              check your AI Studio rate limits{" "}
              <a href="https://aistudio.google.com/rate-limit" target="_blank">
                here
              </a>
              .
            </span>
            <span className="flex flex-wrap gap-2">
              {exhaustedModelIds.map((modelId) => (
                <Badge
                  key={modelId}
                  variant="outline"
                  className="border-amber-300 bg-white/60 text-amber-950"
                >
                  {modelId}
                </Badge>
              ))}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-3 text-sm">
            <DetailRow label="State" value={formatRunnerState(status?.state)} />
            <DetailRow
              label="Processed"
              value={formatTaskCount(status?.processedTaskCount ?? 0)}
            />
            <DetailRow
              label="Skipped"
              value={formatTaskCount(status?.skippedTaskCount ?? 0)}
            />
            <DetailRow
              label="Started"
              value={formatMaybeDate(status?.startedAt)}
            />
            <DetailRow
              label="Finished"
              value={formatMaybeDate(status?.finishedAt)}
            />
          </div>

          <div className="grid gap-2 border-t pt-5">
            <div className="text-sm font-medium">Current task</div>
            {currentTask ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{currentTask.type}</Badge>
                  <span className="font-medium">{currentTask.label}</span>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <PathLine label="Book" value={currentTask.bookPath} />
                  <PathLine label="Page" value={currentTask.pagePath} />
                </div>
              </div>
            ) : (
              <MutedText>No active task.</MutedText>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

function PathLine({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <span className="font-medium text-foreground">{label}: </span>
      <span className="break-words">{value ?? "None"}</span>
    </div>
  );
}

function MutedText({ children }: { children: string }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}

function formatRunnerState(state: RunnerState | null | undefined): string {
  if (state === RunnerState.Running) {
    return "Running";
  }

  if (state === RunnerState.StoppedAfterError) {
    return "Stopped after error";
  }

  if (state === RunnerState.IdleWithSkippedTasks) {
    return "Skipped tasks";
  }

  return "Idle";
}

function formatTaskCount(count: number): string {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

function formatMaybeDate(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "None";
  }

  return new Date(value).toLocaleString();
}
