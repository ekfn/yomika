import { useMutation, useQuery } from "@apollo/client/react";
import { Loader2, Play, Square } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  RunnerState,
  RunnerStatusDocument,
  RequestRunnerStopDocument,
  StartRunnerDocument,
} from "@/graphql/generated/graphql";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { AiProcessingSettingsTabContent } from "@/features/runner/components/ai-processing-settings-tab-content";
import { ModelOptionsTabContent } from "@/features/runner/components/model-options-tab-content";
import { RunnerOperationLogTabContent } from "@/features/runner/components/runner-operation-log-tab-content";
import { RunnerStatusTabContent } from "@/features/runner/components/runner-status-tab-content";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RUNNER_TAB_SEARCH_PARAM = "tab";
const RUNNER_TAB_VALUES = [
  "status",
  "ai-processing",
  "model-options",
  "logs",
] as const;
const DEFAULT_RUNNER_TAB_VALUE = "status";

type RunnerTab = (typeof RUNNER_TAB_VALUES)[number];

const RUNNER_TAB_LABELS = {
  status: "Status",
  "ai-processing": "AI Processing Settings",
  "model-options": "Models",
  logs: "Logs",
} satisfies Record<RunnerTab, string>;

function isRunnerTab(value: string | null): value is RunnerTab {
  return RUNNER_TAB_VALUES.some((tabValue) => tabValue === value);
}

function getRunnerTab(value: string | null): RunnerTab {
  return isRunnerTab(value) ? value : DEFAULT_RUNNER_TAB_VALUE;
}

function getRunnerTabSearch(
  searchParams: URLSearchParams,
  tabValue: RunnerTab,
) {
  const nextSearchParams = new URLSearchParams(searchParams);

  nextSearchParams.set(RUNNER_TAB_SEARCH_PARAM, tabValue);

  return `?${nextSearchParams.toString()}`;
}

export function RunnerRoute() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeTab = getRunnerTab(searchParams.get(RUNNER_TAB_SEARCH_PARAM));
  const { data, loading, error, refetch } = useQuery(RunnerStatusDocument);
  const [startRunner, startState] = useMutation(StartRunnerDocument);
  const [requestRunnerStop, stopState] = useMutation(RequestRunnerStopDocument);

  if (loading && !data) {
    return (
      <>
        <title>{`Runner | Yomika`}</title>
        <LoadingState />
      </>
    );
  }

  if (error) {
    return (
      <>
        <title>{`Runner | Yomika`}</title>
        <ErrorState message={error.message} />
      </>
    );
  }

  const status = data?.runnerStatus;
  const isRunning = status?.state === RunnerState.Running;
  const stopRequested = status?.stopRequested ?? false;

  return (
    <div className="grid gap-6">
      <title>{`Runner | Yomika`}</title>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Runner</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRunning ? (
            <Button
              type="button"
              onClick={async () => {
                await requestRunnerStop();
                await refetch();
              }}
              disabled={stopRequested || stopState.loading}
            >
              {stopState.loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Square />
              )}
              {stopRequested ? "Stopping..." : "Stop"}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={async () => {
              await startRunner();
              await refetch();
            }}
            disabled={isRunning || startState.loading}
          >
            {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
            {isRunning ? "Running" : "Start"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} className="gap-5">
        <div className="overflow-x-auto pb-1.5">
          <TabsList variant="line" className="min-w-max">
            {RUNNER_TAB_VALUES.map((tabValue) => (
              <TabsTrigger key={tabValue} value={tabValue} asChild>
                <Link
                  to={{
                    pathname: location.pathname,
                    search: getRunnerTabSearch(searchParams, tabValue),
                    hash: location.hash,
                  }}
                  onClick={(event) => {
                    if (tabValue === activeTab) {
                      event.preventDefault();
                    }
                  }}
                >
                  {RUNNER_TAB_LABELS[tabValue]}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {activeTab === "status" ? (
          <RunnerStatusTabContent status={status ?? null} />
        ) : null}

        {activeTab === "ai-processing" ? (
          <AiProcessingSettingsTabContent isRunnerRunning={isRunning} />
        ) : null}

        {activeTab === "model-options" ? (
          <ModelOptionsTabContent isRunnerRunning={isRunning} />
        ) : null}

        {activeTab === "logs" ? <RunnerOperationLogTabContent /> : null}
      </Tabs>
    </div>
  );
}
