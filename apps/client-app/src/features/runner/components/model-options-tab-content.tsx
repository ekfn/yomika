import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Plus } from "lucide-react";
import {
  AiProcessingConfigDocument,
  UpdateAiProcessingConfigDocument,
} from "@/graphql/generated/graphql";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  addModelOption,
  hasModelOptionsChanges,
  removeModelOption,
  toFormState,
  toUpdateInput,
  updateModelOption,
  validateModelOptionsForm,
  type AiProcessingConfigForm,
} from "../model/ai-processing-config-form-model";
import { ModelOptionRow } from "./model-option-row";
import {
  SaveButton,
  SettingsCardFrame,
  SettingsFooter,
} from "./settings-card-frame";

type ModelOptionsTabContentProps = {
  isRunnerRunning: boolean;
};

export function ModelOptionsTabContent({
  isRunnerRunning,
}: ModelOptionsTabContentProps) {
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
    () => (form ? validateModelOptionsForm(form) : []),
    [form],
  );
  const isSaving = updateState.loading;
  const isDisabled = isRunnerRunning || isSaving || loading;

  if (loading && !form) {
    return (
      <TabsContent value="model-options">
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
    <TabsContent value="model-options">
      <SettingsCardFrame
        title="Models"
        description="Edit the models available to AI processing steps."
        error={error?.message ?? null}
        saveError={saveError}
        isRunnerRunning={isRunnerRunning}
        validationErrors={hasAttemptedSave ? validationErrors : []}
        footer={<SettingsFooter isSaving={isSaving} />}
        headerAction={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (form) {
                setForm(addModelOption(form));
              }
            }}
            disabled={!form || isDisabled}
          >
            <Plus />
            Add model
          </Button>
        }
        footerAction={
          <SaveButton
            disabled={
              !form ||
              isDisabled ||
              !hasModelOptionsChanges(form, data?.aiProcessingConfig)
            }
            onClick={() => void saveConfig()}
          />
        }
      >
        {form ? (
          <section className="grid gap-2">
            {form.modelOptions.map((option, index) => (
              <ModelOptionRow
                key={index}
                disabled={isDisabled}
                modelOption={option}
                canRemove={form.modelOptions.length > 1}
                onChange={(nextOption) => {
                  setForm(updateModelOption(form, index, nextOption));
                }}
                onRemove={() => {
                  setForm(removeModelOption(form, index));
                }}
              />
            ))}
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
