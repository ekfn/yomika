import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  AiThinkingMode,
  type AiProcessingStep,
  type AiThinkingLevel,
} from "@/graphql/generated/graphql";
import { Badge } from "@/components/ui/badge";
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
  moveStepModelConfig,
  normalizeStepModelForModel,
  removeStepModelConfig,
  STEP_LABELS,
  THINKING_LEVEL_LABELS,
  THINKING_LEVEL_ORDER,
  THINKING_MODE_LABELS,
  updateStepModelConfig,
  type AiProcessingConfigForm,
  type ModelOptionForm,
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
    <div className="grid gap-3 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{STEP_LABELS[step]}</div>
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
  const modelOption = form.modelOptions.find(
    (option) => option.id === modelConfig.modelId,
  );

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[72px_minmax(0,1fr)_180px_auto] md:items-center">
      <div className="text-sm font-medium text-muted-foreground">
        #{index + 1}
      </div>

      <Field>
        <FieldLabel className="sr-only">Model</FieldLabel>
        <Select
          value={modelConfig.modelId}
          onValueChange={(modelId) => {
            const nextModelOption = form.modelOptions.find(
              (option) => option.id === modelId,
            );

            onChange(
              normalizeStepModelForModel(
                {
                  ...modelConfig,
                  modelId,
                },
                nextModelOption,
              ),
            );
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {form.modelOptions
              .filter((option) => option.id.trim().length > 0)
              .map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.id}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>

      <ThinkingControl
        disabled={disabled}
        modelOption={modelOption}
        value={modelConfig.thinkingLevel}
        onChange={(thinkingLevel) => {
          onChange({
            ...modelConfig,
            thinkingLevel,
          });
        }}
      />

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

function ThinkingControl({
  disabled,
  modelOption,
  value,
  onChange,
}: {
  disabled: boolean;
  modelOption: ModelOptionForm | undefined;
  value: AiThinkingLevel | null;
  onChange: (thinkingLevel: AiThinkingLevel | null) => void;
}) {
  if (!modelOption) {
    return <Badge variant="destructive">Missing model</Badge>;
  }

  if (modelOption.thinkingMode !== AiThinkingMode.Level) {
    return (
      <Badge variant="secondary">
        {THINKING_MODE_LABELS[modelOption.thinkingMode]}
      </Badge>
    );
  }

  return (
    <Field>
      <FieldLabel className="sr-only">Thinking level</FieldLabel>
      <Select
        value={value ?? ""}
        onValueChange={(nextValue) => {
          onChange(nextValue as AiThinkingLevel);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Level" />
        </SelectTrigger>
        <SelectContent>
          {THINKING_LEVEL_ORDER.map((level) => (
            <SelectItem key={level} value={level}>
              {THINKING_LEVEL_LABELS[level]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
