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
  addModel,
  addModelProfile,
  hasModelsChanges,
  removeModel,
  removeModelProfile,
  toFormState,
  toUpdateInput,
  updateModel,
  updateModelProfile,
  validateModelsForm,
  type AiProcessingConfigForm,
} from "../model/ai-processing-config-form-model";
import { ModelRow } from "./model-row";
import {
  SaveButton,
  SettingsCardFrame,
  SettingsFooter,
} from "./settings-card-frame";

type ModelsTabContentProps = {
  isRunnerRunning: boolean;
};

export function ModelsTabContent({ isRunnerRunning }: ModelsTabContentProps) {
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
    () => (form ? validateModelsForm(form) : []),
    [form],
  );
  const isSaving = updateState.loading;
  const isDisabled = isRunnerRunning || isSaving || loading;

  if (loading && !form) {
    return (
      <TabsContent value="models">
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
    <TabsContent value="models">
      <SettingsCardFrame
        title="Model Profiles"
        description="Edit provider models and reusable parameter profiles."
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
              !hasModelsChanges(form, data?.aiProcessingConfig)
            }
            onClick={() => void saveConfig()}
          />
        }
      >
        {form ? (
          <section className="grid gap-4">
            {form.models.map((model, modelIndex) => (
              <ModelRow
                key={modelIndex}
                disabled={isDisabled}
                model={model}
                canRemove={form.models.length > 1}
                onChange={(nextModel) => {
                  setForm(updateModel(form, modelIndex, nextModel));
                }}
                onRemove={() => {
                  setForm(removeModel(form, modelIndex));
                }}
                onAddProfile={() => {
                  setForm(addModelProfile(form, modelIndex));
                }}
                onProfileChange={(profileIndex, nextProfile) => {
                  setForm(
                    updateModelProfile(
                      form,
                      modelIndex,
                      profileIndex,
                      nextProfile,
                    ),
                  );
                }}
                onProfileRemove={(profileIndex) => {
                  setForm(removeModelProfile(form, modelIndex, profileIndex));
                }}
              />
            ))}
            <div className="flex justify-start pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm(addModel(form));
                }}
                disabled={isDisabled}
              >
                <Plus />
                Add model
              </Button>
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
