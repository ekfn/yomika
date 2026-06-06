import {
  Field,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

const AI_PROCESSING_ENABLED_VALUE = "enabled";
const AI_PROCESSING_DISABLED_VALUE = "disabled";
const AI_PROCESSING_INHERIT_VALUE = "inherit";

type AiProcessingFeatureFieldProps = {
  aiProcessingEnabled: boolean | null;
  allowInherit?: boolean;
  id: string;
  onAiProcessingEnabledChange: (value: boolean | null) => void;
};

export function AiProcessingFeatureField({
  aiProcessingEnabled,
  allowInherit = false,
  id,
  onAiProcessingEnabledChange,
}: AiProcessingFeatureFieldProps) {
  const value =
    allowInherit && aiProcessingEnabled === null
      ? AI_PROCESSING_INHERIT_VALUE
      : aiProcessingEnabled
        ? AI_PROCESSING_ENABLED_VALUE
        : AI_PROCESSING_DISABLED_VALUE;

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor={id}>Run AI processing</FieldLabel>
        <Select
          value={value}
          onValueChange={(value) => {
            onAiProcessingEnabledChange(
              allowInherit && value === AI_PROCESSING_INHERIT_VALUE
                ? null
                : value === AI_PROCESSING_ENABLED_VALUE,
            );
          }}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowInherit ? (
              <SelectItem value={AI_PROCESSING_INHERIT_VALUE}>
                Inherit from book
              </SelectItem>
            ) : null}
            <SelectItem value={AI_PROCESSING_ENABLED_VALUE}>Enabled</SelectItem>
            <SelectItem value={AI_PROCESSING_DISABLED_VALUE}>
              Disabled
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}
