import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  AiProcessingConfigDocument,
  UpdateAiProcessingConfigDocument,
} from "@/graphql/generated/graphql";
import { LoadingState } from "@/components/common/loading-state";
import { TabsContent } from "@/components/ui/tabs";
import {
  hasAiProcessingSettingsChanges,
  STEP_ORDER,
  toFormState,
  toUpdateInput,
  validateAiProcessingSettingsForm,
  type AiProcessingConfigForm,
} from "../model/ai-processing-config-form-model";
import {
  SaveButton,
  SettingsCardFrame,
  SettingsFooter,
} from "./settings-card-frame";
import { StepSettingsRow } from "./step-settings-row";

type AiProcessingSettingsTabContentProps = {
  isRunnerRunning: boolean;
};

export function AiProcessingSettingsTabContent({
  isRunnerRunning,
}: AiProcessingSettingsTabContentProps) {
  const { data, loading, error, refetch } = useQuery(
    AiProcessingConfigDocument,
  );
  const [updateConfig, updateState] = useMutation(
    UpdateAiProcessingConfigDocument,
  );
  const [form, setForm] = useState<AiProcessingConfigForm | null>(null);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.aiProcessingConfig) {
      return;
    }

    setForm(toFormState(data.aiProcessingConfig));
  }, [data?.aiProcessingConfig]);

  const validationErrors = useMemo(
    () => (form ? validateAiProcessingSettingsForm(form) : []),
    [form],
  );
  const isSaving = updateState.loading;
  const isDisabled = isRunnerRunning || isSaving || loading;

  if (loading && !form) {
    return (
      <TabsContent value="ai-processing">
        <LoadingState />
      </TabsContent>
    );
  }

  const saveConfig = async () => {
    setHasAttemptedSave(true);
    setSaveError(null);

    if (!form || validationErrors.length > 0) {
      return;
    }

    try {
      const result = await updateConfig({
        variables: {
          input: toUpdateInput(form),
        },
      });

      if (result.data?.updateAiProcessingConfig) {
        setForm(toFormState(result.data.updateAiProcessingConfig));
      }

      setHasAttemptedSave(false);
      await refetch();
    } catch (error) {
      setSaveError(getErrorMessage(error));
    }
  };

  return (
    <TabsContent value="ai-processing">
      <SettingsCardFrame
        title="AI Processing Settings"
        description="Select the ordered model profiles used by each AI step."
        error={error?.message ?? null}
        saveError={saveError}
        isRunnerRunning={isRunnerRunning}
        validationErrors={hasAttemptedSave ? validationErrors : []}
        footer={<SettingsFooter isSaving={isSaving} />}
        footerAction={
          <SaveButton
            disabled={
              !form ||
              isDisabled ||
              !hasAiProcessingSettingsChanges(form, data?.aiProcessingConfig)
            }
            onClick={() => void saveConfig()}
          />
        }
      >
        {form ? (
          <section className="grid gap-3">
            <div className="grid gap-4">
              {STEP_ORDER.map((step) => (
                <StepSettingsRow
                  key={step}
                  disabled={isDisabled}
                  form={form}
                  step={step}
                  onChange={(nextStepConfig) => {
                    setForm({
                      ...form,
                      steps: {
                        ...form.steps,
                        [step]: nextStepConfig,
                      },
                    });
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}
      </SettingsCardFrame>
    </TabsContent>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
