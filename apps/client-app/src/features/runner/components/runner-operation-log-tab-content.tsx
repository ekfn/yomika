import { useQuery } from "@apollo/client/react";
import { AlertTriangle } from "lucide-react";
import {
  RunnerOperationLogDocument,
  type RunnerOperationLogEntryFieldsFragment,
} from "@/graphql/generated/graphql";
import { LoadingState } from "@/components/common/loading-state";
import { RefreshButton } from "@/components/common/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";

export function RunnerOperationLogTabContent() {
  const { data, loading, error, refetch } = useQuery(
    RunnerOperationLogDocument,
    {
      variables: {
        limit: 200,
      },
    },
  );

  if (loading && !data) {
    return (
      <TabsContent value="logs">
        <LoadingState />
      </TabsContent>
    );
  }

  return (
    <TabsContent value="logs">
      <RunnerOperationLogCard
        entries={data?.runnerOperationLog ?? []}
        error={error?.message ?? null}
        loading={loading}
        onRefresh={() => refetch()}
      />
    </TabsContent>
  );
}

function RunnerOperationLogCard({
  entries,
  error,
  loading,
  onRefresh,
}: {
  entries: RunnerOperationLogEntryFieldsFragment[];
  error: string | null;
  loading: boolean;
  onRefresh: () => Promise<unknown> | unknown;
}) {
  const visibleEntries = [...entries].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs</CardTitle>
        <CardAction>
          <RefreshButton
            label="Refresh"
            loading={loading}
            onRefresh={onRefresh}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">No log entries</div>
        ) : null}

        {visibleEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[720px] overflow-hidden rounded-lg border text-sm">
              <div className="grid grid-cols-[180px_120px_100px_minmax(0,1fr)] gap-3 border-b bg-muted/40 px-3 py-2 font-medium text-muted-foreground">
                <div>Time</div>
                <div>Operation</div>
                <div>Phase</div>
                <div>Details</div>
              </div>
              {visibleEntries.map((entry, index) => (
                <div
                  key={`${entry.runId}-${entry.ts}-${entry.phase}-${index}`}
                  className="grid grid-cols-[180px_120px_100px_minmax(0,1fr)] gap-3 border-b px-3 py-2 last:border-b-0"
                >
                  <div className="text-muted-foreground">
                    {formatMaybeDate(entry.ts)}
                  </div>
                  <div className="font-medium">{entry.operation}</div>
                  <div>{entry.phase}</div>
                  <div className="break-words">
                    <LogEntryDetails entry={entry} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LogEntryDetails({
  entry,
}: {
  entry: RunnerOperationLogEntryFieldsFragment;
}) {
  if (entry.params) {
    return (
      <>
        {[
          entry.params.label,
          `book: ${entry.params.bookPath ?? "None"}`,
          `page: ${entry.params.pagePath ?? "None"}`,
        ].join(" · ")}
      </>
    );
  }

  if (entry.result) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <RunnerOperationResultBadge status={entry.result.status} />
        <span>{entry.result.durationMs} ms</span>
        {entry.result.message ? <span>{entry.result.message}</span> : null}
      </span>
    );
  }

  if (entry.model) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">model</span>
        <span className="font-medium">{entry.model}</span>
      </span>
    );
  }

  return <>No details</>;
}

function RunnerOperationResultBadge({ status }: { status: string }) {
  if (status === "error") {
    return <Badge variant="destructive">error</Badge>;
  }

  if (status === "skipped") {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-950"
      >
        skipped
      </Badge>
    );
  }

  return <Badge variant="secondary">success</Badge>;
}

function formatMaybeDate(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "None";
  }

  return new Date(value).toLocaleString();
}
