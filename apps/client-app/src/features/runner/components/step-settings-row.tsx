import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type AiProcessingStep } from "@/graphql/generated/graphql";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addStepModelConfig,
  getModelProfileOptions,
  getProfileKey,
  moveStepModelConfig,
  PROVIDER_LABELS,
  removeStepModelConfig,
  STEP_LABELS,
  updateStepModelConfig,
  type AiProcessingConfigForm,
  type StepConfigForm,
  type StepModelConfigForm,
} from "../model/ai-processing-config-form-model";

export function StepSettingsRow({
  disabled,
  form,
  step,
  onChange,
}: {
  disabled: boolean;
  form: AiProcessingConfigForm;
  step: AiProcessingStep;
  onChange: (stepConfig: StepConfigForm) => void;
}) {
  const stepConfig = form.steps[step];

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="font-medium">{STEP_LABELS[step]}</div>

      <div className="grid gap-2">
        {stepConfig.models.map((modelConfig, index) => (
          <StepModelConfigRow
            key={index}
            disabled={disabled}
            form={form}
            index={index}
            modelConfig={modelConfig}
            canMoveDown={index < stepConfig.models.length - 1}
            canMoveUp={index > 0}
            canRemove={stepConfig.models.length > 1}
            onChange={(nextModelConfig) => {
              onChange(
                updateStepModelConfig(stepConfig, index, nextModelConfig),
              );
            }}
            onMoveDown={() => {
              onChange(moveStepModelConfig(stepConfig, index, index + 1));
            }}
            onMoveUp={() => {
              onChange(moveStepModelConfig(stepConfig, index, index - 1));
            }}
            onRemove={() => {
              onChange(removeStepModelConfig(stepConfig, index));
            }}
          />
        ))}

        <div className="flex justify-start pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange(addStepModelConfig(stepConfig, form));
            }}
          >
            <Plus />
            Add model
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepModelConfigRow({
  disabled,
  form,
  index,
  modelConfig,
  canMoveDown,
  canMoveUp,
  canRemove,
  onChange,
  onMoveDown,
  onMoveUp,
  onRemove,
}: {
  disabled: boolean;
  form: AiProcessingConfigForm;
  index: number;
  modelConfig: StepModelConfigForm;
  canMoveDown: boolean;
  canMoveUp: boolean;
  canRemove: boolean;
  onChange: (modelConfig: StepModelConfigForm) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
}) {
  const profileOptions = getModelProfileOptions(form);

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[48px_minmax(0,1fr)_auto_auto] md:items-center">
      <div className="text-sm font-medium text-muted-foreground">
        #{index + 1}
      </div>

      <Field>
        <FieldLabel className="sr-only">Model profile</FieldLabel>
        <Select
          value={getProfileKey(modelConfig)}
          onValueChange={(profileKey) => {
            const nextProfileOption = profileOptions.find(
              (option) => option.key === profileKey,
            );

            if (!nextProfileOption) {
              return;
            }

            onChange({
              provider: nextProfileOption.provider,
              modelId: nextProfileOption.modelId,
              profileName: nextProfileOption.profileName,
            });
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {profileOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.modelId} ({PROVIDER_LABELS[option.provider]}) -{" "}
                {option.profileName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onMoveUp}
          disabled={disabled || !canMoveUp}
        >
          <ArrowUp />
          <span className="sr-only">Move model up</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onMoveDown}
          disabled={disabled || !canMoveDown}
        >
          <ArrowDown />
          <span className="sr-only">Move model down</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={disabled || !canRemove}
        >
          <Trash2 />
          <span className="sr-only">Remove model from step</span>
        </Button>
      </div>
    </div>
  );
}
