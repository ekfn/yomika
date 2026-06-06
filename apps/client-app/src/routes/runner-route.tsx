import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Loader2, Play, Square } from "lucide-react";
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

type RunnerTab = "status" | "ai-processing" | "model-options" | "logs";

export function RunnerRoute() {
  const [activeTab, setActiveTab] = useState<RunnerTab>("status");
  const { data, loading, error, refetch } = useQuery(RunnerStatusDocument);
  const [startRunner, startState] = useMutation(StartRunnerDocument);
  const [requestRunnerStop, stopState] = useMutation(RequestRunnerStopDocument);

  if (loading && !data) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const status = data?.runnerStatus;
  const isRunning = status?.state === RunnerState.Running;
  const stopRequested = status?.stopRequested ?? false;

  return (
    <div className="grid gap-6">
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

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as RunnerTab);
        }}
        className="gap-5"
      >
        <div className="overflow-x-auto pb-1.5">
          <TabsList variant="line" className="min-w-max">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="ai-processing">
              AI Processing Settings
            </TabsTrigger>
            <TabsTrigger value="model-options">Models</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
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
