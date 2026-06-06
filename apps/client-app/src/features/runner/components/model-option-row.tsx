import { Trash2 } from "lucide-react";
import type { AiThinkingMode } from "@/graphql/generated/graphql";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  THINKING_MODE_LABELS,
  THINKING_MODE_OPTIONS,
  type ModelOptionForm,
} from "../model/ai-processing-config-form-model";

export function ModelOptionRow({
  disabled,
  modelOption,
  canRemove,
  onChange,
  onRemove,
}: {
  disabled: boolean;
  modelOption: ModelOptionForm;
  canRemove: boolean;
  onChange: (modelOption: ModelOptionForm) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-background p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_auto] lg:items-start">
        <Field>
          <FieldLabel>Model ID</FieldLabel>
          <Input
            value={modelOption.id}
            onChange={(event) => {
              onChange({
                ...modelOption,
                id: event.target.value,
              });
            }}
            disabled={disabled}
          />
        </Field>

        <Field>
          <FieldLabel>Thinking</FieldLabel>
          <Select
            value={modelOption.thinkingMode}
            onValueChange={(value) => {
              const thinkingMode = value as AiThinkingMode;

              onChange({
                ...modelOption,
                thinkingMode,
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THINKING_MODE_OPTIONS.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {THINKING_MODE_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Requests/min</FieldLabel>
          <Input
            type="number"
            min={1}
            step={1}
            value={modelOption.requestsPerMinute}
            onChange={(event) => {
              onChange({
                ...modelOption,
                requestsPerMinute: Math.trunc(Number(event.target.value)),
              });
            }}
            disabled={disabled}
          />
        </Field>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="self-end justify-self-start lg:justify-self-end"
          onClick={onRemove}
          disabled={disabled || !canRemove}
        >
          <Trash2 />
          <span className="sr-only">Remove model</span>
        </Button>
      </div>
    </div>
  );
}
