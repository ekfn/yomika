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

type RunnerCurrentTask = NonNullable<RunnerStatusFieldsFragment["currentTask"]>;

const MODEL_RUN_KEY_SEPARATOR = "__";

const RATE_LIMIT_INFO_BY_PROVIDER = {
  gemini: {
    label: "Gemini",
    href: "https://aistudio.google.com/rate-limit",
    linkLabel: "Google AI Studio rate limits",
  },
  "github-models": {
    label: "GitHub Models",
    href: "https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models#rate-limits",
    linkLabel: "GitHub Models rate limits",
  },
} as const;

type RateLimitProvider = keyof typeof RATE_LIMIT_INFO_BY_PROVIDER;

type ExhaustedModelGroup = {
  key: string;
  label: string;
  href: string | null;
  linkLabel: string | null;
  modelIds: string[];
};

export function RunnerStatusTabContent({
  status,
}: RunnerStatusTabContentProps) {
  const currentTask = status?.currentTask ?? null;
  const lastError = status?.lastError ?? null;
  const exhaustedModelIds = status?.exhaustedModelIds ?? [];
  const exhaustedModelGroups = groupExhaustedModelIds(exhaustedModelIds);

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
          <AlertDescription className="grid gap-3">
            <span>
              These models returned rate limit errors during this run. Check the
              provider rate limit page for the affected models.
            </span>
            <div className="grid gap-3">
              {exhaustedModelGroups.map((group) => (
                <div key={group.key} className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium">{group.label}</span>
                    {group.href ? (
                      <a href={group.href} target="_blank" rel="noreferrer">
                        {group.linkLabel}
                      </a>
                    ) : null}
                  </div>
                  <span className="flex flex-wrap gap-2">
                    {group.modelIds.map((modelId) => (
                      <Badge
                        key={modelId}
                        variant="outline"
                        className="border-amber-300 bg-white/60 text-amber-950"
                      >
                        {modelId}
                      </Badge>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {currentTask ? <CurrentTaskCard task={currentTask} /> : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
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
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function CurrentTaskCard({ task }: { task: RunnerCurrentTask }) {
  const hasPath = Boolean(task.bookPath || task.pagePath);

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Current task</CardTitle>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            Running
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{task.type}</Badge>
          <span className="font-medium">{task.label}</span>
        </div>

        {hasPath ? (
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <PathLine label="Book" value={task.bookPath} />
            <PathLine label="Page" value={task.pagePath} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function groupExhaustedModelIds(
  exhaustedModelIds: readonly string[],
): ExhaustedModelGroup[] {
  const groups = new Map<string, ExhaustedModelGroup>();

  for (const modelId of exhaustedModelIds) {
    const provider = parseModelRunProvider(modelId);
    const rateLimitInfo = provider
      ? RATE_LIMIT_INFO_BY_PROVIDER[provider]
      : null;
    const key = provider ?? "unknown";
    const group = groups.get(key) ?? {
      key,
      label: rateLimitInfo?.label ?? "Unknown provider",
      href: rateLimitInfo?.href ?? null,
      linkLabel: rateLimitInfo?.linkLabel ?? null,
      modelIds: [],
    };

    group.modelIds.push(modelId);
    groups.set(key, group);
  }

  return [
    ...Object.keys(RATE_LIMIT_INFO_BY_PROVIDER)
      .map((provider) => groups.get(provider))
      .filter((group): group is ExhaustedModelGroup => Boolean(group)),
    ...[...groups.values()].filter((group) => !isRateLimitProvider(group.key)),
  ];
}

function parseModelRunProvider(modelRunKey: string): RateLimitProvider | null {
  const provider = modelRunKey.split(MODEL_RUN_KEY_SEPARATOR)[0] ?? "";

  return isRateLimitProvider(provider) ? provider : null;
}

function isRateLimitProvider(value: string): value is RateLimitProvider {
  return value in RATE_LIMIT_INFO_BY_PROVIDER;
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
