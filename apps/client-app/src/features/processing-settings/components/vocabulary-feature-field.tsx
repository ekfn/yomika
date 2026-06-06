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

const VOCABULARY_ENABLED_VALUE = "enabled";
const VOCABULARY_DISABLED_VALUE = "disabled";
const VOCABULARY_INHERIT_VALUE = "inherit";

type VocabularyFeatureFieldProps = {
  allowInherit?: boolean;
  id: string;
  vocabularyEnabled: boolean | null;
  onVocabularyEnabledChange: (value: boolean | null) => void;
};

export function VocabularyFeatureField({
  allowInherit = false,
  id,
  vocabularyEnabled,
  onVocabularyEnabledChange,
}: VocabularyFeatureFieldProps) {
  const value =
    allowInherit && vocabularyEnabled === null
      ? VOCABULARY_INHERIT_VALUE
      : vocabularyEnabled
        ? VOCABULARY_ENABLED_VALUE
        : VOCABULARY_DISABLED_VALUE;

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor={id}>Vocabulary</FieldLabel>
        <Select
          value={value}
          onValueChange={(value) => {
            onVocabularyEnabledChange(
              allowInherit && value === VOCABULARY_INHERIT_VALUE
                ? null
                : value === VOCABULARY_ENABLED_VALUE,
            );
          }}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowInherit ? (
              <SelectItem value={VOCABULARY_INHERIT_VALUE}>
                Inherit from book
              </SelectItem>
            ) : null}
            <SelectItem value={VOCABULARY_ENABLED_VALUE}>Enabled</SelectItem>
            <SelectItem value={VOCABULARY_DISABLED_VALUE}>Disabled</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}
