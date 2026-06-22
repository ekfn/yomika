import { Plus, Trash2 } from "lucide-react";
import { AiModelProvider } from "@/graphql/generated/graphql";
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
  PROVIDER_LABELS,
  PROVIDER_OPTIONS,
  type AiModelForm,
  type AiModelProfileForm,
} from "../model/ai-processing-config-form-model";
import { ParametersJsonField } from "./parameters-json-field";

export function ModelRow({
  disabled,
  model,
  canRemove,
  onChange,
  onRemove,
  onAddProfile,
  onProfileChange,
  onProfileRemove,
}: {
  disabled: boolean;
  model: AiModelForm;
  canRemove: boolean;
  onChange: (model: AiModelForm) => void;
  onRemove: () => void;
  onAddProfile: () => void;
  onProfileChange: (profileIndex: number, profile: AiModelProfileForm) => void;
  onProfileRemove: (profileIndex: number) => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border p-3  bg-muted/20">
      <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_160px_auto] lg:items-start">
        <Field>
          <FieldLabel>Provider</FieldLabel>
          <Select
            value={model.provider}
            onValueChange={(value) => {
              const provider = value as AiModelProvider;

              onChange({
                ...model,
                provider,
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {PROVIDER_LABELS[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Model ID</FieldLabel>
          <Input
            value={model.modelId}
            onChange={(event) => {
              onChange({
                ...model,
                modelId: event.target.value,
              });
            }}
            disabled={disabled}
          />
        </Field>

        <Field>
          <FieldLabel>Requests/min</FieldLabel>
          <Input
            type="number"
            min={1}
            step={1}
            value={model.requestsPerMinute}
            onChange={(event) => {
              onChange({
                ...model,
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

      <div className="grid gap-2">
        <div className="text-sm font-medium">Profiles</div>

        <div className="grid gap-2">
          {model.profiles.map((profile, profileIndex) => (
            <ProfileRow
              key={profileIndex}
              disabled={disabled}
              provider={model.provider}
              profile={profile}
              canRemove={model.profiles.length > 1}
              onChange={(nextProfile) => {
                onProfileChange(profileIndex, nextProfile);
              }}
              onRemove={() => {
                onProfileRemove(profileIndex);
              }}
            />
          ))}
        </div>

        <div className="flex justify-start pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddProfile}
            disabled={disabled}
          >
            <Plus />
            Add profile
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({
  disabled,
  provider,
  profile,
  canRemove,
  onChange,
  onRemove,
}: {
  disabled: boolean;
  provider: AiModelProvider;
  profile: AiModelProfileForm;
  canRemove: boolean;
  onChange: (profile: AiModelProfileForm) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid bg-background gap-3 rounded-md border p-3 lg:grid-cols-[minmax(160px,220px)_minmax(0,1fr)_auto] lg:items-start">
      <Field>
        <FieldLabel>Profile</FieldLabel>
        <Input
          value={profile.name}
          onChange={(event) => {
            onChange({
              ...profile,
              name: event.target.value,
            });
          }}
          disabled={disabled}
        />
      </Field>

      <ParametersJsonField
        disabled={disabled}
        value={profile.parametersJson}
        placeholder={getParametersPlaceholder(provider)}
        emptyLabel="No extra parameters"
        label="Parameters JSON"
        onChange={(parametersJson) => {
          onChange({
            ...profile,
            parametersJson,
          });
        }}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={disabled || !canRemove}
      >
        <Trash2 />
        <span className="sr-only">Remove profile</span>
      </Button>
    </div>
  );
}

function getParametersPlaceholder(provider: AiModelProvider): string {
  switch (provider) {
    case AiModelProvider.Gemini:
      return '{"thinkingConfig":{"thinkingLevel":"HIGH"}}';
    case AiModelProvider.GithubModels:
      return '{"temperature":0.2,"max_tokens":4000}';
  }
}
