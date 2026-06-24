import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { ImagePlus } from "lucide-react";
import {
  formatUploadFileSize,
  UPLOAD_ALLOWED_IMAGE_MIME_TYPES,
  UPLOAD_MAX_FILE_SIZE_BYTES,
} from "@yomika/shared";
import {
  type PageListFieldsFragment,
  type PageQuery,
  type PageSettingsInput,
  CreatePageDocument,
  LibrarySettingsDefaultsDocument,
  StartRunnerDocument,
} from "@/graphql/generated/graphql";
import {
  FolderLocationStrip,
  ROOT_FOLDER_LABEL,
} from "@/features/library/components/folder-location-info";
import { AiProcessingFeatureField } from "@/features/processing-settings/components/ai-processing-feature-field";
import { VocabularyFeatureField } from "@/features/processing-settings/components/vocabulary-feature-field";
import { uploadPageImage } from "@/features/uploads/api/upload-client";
import { LargeFileUploadField } from "@/features/uploads/components/large-file-upload-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { getNameFromFileName } from "@/lib/file-name";

type PageFormDialogProps = {
  defaultParentPath?: string | null;
  defaultParentLabel?: string | null;
  open?: boolean;
  trigger?: ReactNode | null;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (path?: string) => Promise<void> | void;
};

export type PageFormDialogPage = Pick<
  NonNullable<PageQuery["page"]> | PageListFieldsFragment,
  "path" | "bookPath" | "settings" | "effectiveSettings"
>;

type PageFormErrors = {
  sourceUploadId?: string | undefined;
  name?: string | undefined;
} & PageSettingsFieldErrors;

export type PageSettingsFieldErrors = {
  sourceLanguages?: string | undefined;
  targetLanguage?: string | undefined;
};

type PageFormContentProps = {
  defaultParentPath: string | null | undefined;
  defaultParentLabel: string | null | undefined;
  onClose: () => void;
  onCompleted: ((path?: string) => Promise<void> | void) | undefined;
};

const INHERIT_SETTINGS_VALUE = "inherit";
const CUSTOM_SETTINGS_VALUE = "custom";

export function getInitialPageSourceLanguages(
  page: PageFormDialogPage | undefined,
): string | null {
  if (!page) {
    return "";
  }

  if (page.settings.translationSourceLanguages === undefined) {
    return page.bookPath ? null : "";
  }

  return page.settings.translationSourceLanguages === null
    ? null
    : page.settings.translationSourceLanguages.join(", ");
}

export function getInitialPageTargetLanguage(
  page: PageFormDialogPage | undefined,
): string | null {
  if (!page) {
    return "";
  }

  if (page.settings.translationTargetLanguage === undefined) {
    return page.bookPath ? null : "";
  }

  return page.settings.translationTargetLanguage;
}

export function getInitialPageVocabularyEnabled(
  page: PageFormDialogPage | undefined,
): boolean | null {
  if (!page) {
    return false;
  }

  if (page.settings.vocabularyEnabled === undefined) {
    return page.bookPath ? null : false;
  }

  return page.settings.vocabularyEnabled;
}

export function getInitialPageAiProcessingEnabled(
  page: PageFormDialogPage | undefined,
): boolean | null {
  if (!page) {
    return true;
  }

  if (page.settings.aiProcessingEnabled === undefined) {
    return page.bookPath ? null : true;
  }

  return page.settings.aiProcessingEnabled;
}

function validatePageImage(file: File): string | null {
  if (
    !UPLOAD_ALLOWED_IMAGE_MIME_TYPES.includes(
      file.type as (typeof UPLOAD_ALLOWED_IMAGE_MIME_TYPES)[number],
    )
  ) {
    return "Select a JPEG, PNG, or WebP source image.";
  }

  if (file.size > UPLOAD_MAX_FILE_SIZE_BYTES) {
    return `Source image must be ${formatUploadFileSize(UPLOAD_MAX_FILE_SIZE_BYTES)} or smaller.`;
  }

  return null;
}

export function PageFormDialog({
  defaultParentPath,
  defaultParentLabel,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: PageFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  function handleOpenChange(nextOpen: boolean) {
    setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="default">
              <ImagePlus />
              New Page
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <PageFormContent
            defaultParentPath={defaultParentPath}
            defaultParentLabel={defaultParentLabel}
            onClose={() => handleOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PageFormContent({
  defaultParentPath,
  defaultParentLabel,
  onClose,
  onCompleted,
}: PageFormContentProps) {
  const [name, setName] = useState("");
  const [sourceLanguages, setSourceLanguages] = useState<string | null>("");
  const [targetLanguage, setTargetLanguage] = useState<string | null>("");
  const [aiProcessingEnabled, setAiProcessingEnabled] = useState<
    boolean | null
  >(true);
  const [vocabularyEnabled, setVocabularyEnabled] = useState<boolean | null>(
    false,
  );
  const [settingsDefaultsApplied, setSettingsDefaultsApplied] = useState(false);
  const [sourceUploadId, setSourceUploadId] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<PageFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createPage, createState] = useMutation(CreatePageDocument);
  const [startRunner] = useMutation(StartRunnerDocument);
  const defaultsQuery = useQuery(LibrarySettingsDefaultsDocument);
  const saving = createState.loading;
  const settingsDefaultsErrorMessage = defaultsQuery.error
    ? defaultsQuery.error.message
    : null;
  const parentPath = defaultParentPath ?? null;
  const parentLabel = defaultParentLabel ?? ROOT_FOLDER_LABEL;

  useEffect(() => {
    if (!defaultsQuery.data) {
      return;
    }

    const defaults = defaultsQuery.data.librarySettingsDefaults;

    setSourceLanguages((currentSourceLanguages) =>
      currentSourceLanguages === null || currentSourceLanguages.trim()
        ? currentSourceLanguages
        : defaults.translationSourceLanguages.join(", "),
    );
    setTargetLanguage((currentTargetLanguage) =>
      currentTargetLanguage === null || currentTargetLanguage.trim()
        ? currentTargetLanguage
        : defaults.translationTargetLanguage,
    );
    setAiProcessingEnabled(defaults.aiProcessingEnabled);
    setVocabularyEnabled(defaults.vocabularyEnabled);
    setSettingsDefaultsApplied(true);
  }, [defaultsQuery.data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const nextFormErrors = validatePageForm({
      sourceUploadId,
      sourceLanguages,
      targetLanguage,
      name,
      canInheritSettings: false,
    });

    if (hasPageFormErrors(nextFormErrors)) {
      setFormErrors(nextFormErrors);
      return;
    }

    setFormErrors({});

    try {
      const settings = buildPageSettingsInput(
        sourceLanguages,
        targetLanguage,
        aiProcessingEnabled,
        vocabularyEnabled,
      );
      const result = await createPage({
        variables: {
          input: {
            name,
            parentPath,
            sourceUploadId: sourceUploadId!,
            settings,
          },
        },
      });
      const completedPath = result.data?.createPage.path;
      void startRunner().catch(() => undefined);

      await onCompleted?.(completedPath);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSourceFileChange(
    file: File,
    options: Parameters<typeof uploadPageImage>[1],
  ) {
    const validationError = validatePageImage(file);

    if (validationError) {
      setImageUploadError(validationError);
      setSourceUploadId(null);
      setFormErrors((currentFormErrors) => ({
        ...currentFormErrors,
        sourceUploadId: validationError,
      }));
      return false;
    }

    setName((currentName) =>
      currentName.trim() ? currentName : getNameFromFileName(file.name),
    );
    setImageUploadError(null);
    setSourceUploadId(null);
    setFormErrors((currentFormErrors) => ({
      ...currentFormErrors,
      sourceUploadId: undefined,
    }));

    try {
      const uploadId = await uploadPageImage(file, options);

      setSourceUploadId(uploadId);
      setImageUploadError(null);
      setFormErrors((currentFormErrors) => ({
        ...currentFormErrors,
        sourceUploadId: undefined,
      }));

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The upload request failed.";

      setImageUploadError(message);
      setSourceUploadId(null);
      setFormErrors((currentFormErrors) => ({
        ...currentFormErrors,
        sourceUploadId: message,
      }));

      return false;
    }
  }

  return (
    <>
      <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b px-4 py-4 pr-12">
        <DialogTitle>New Page</DialogTitle>
      </DialogHeader>
      {!settingsDefaultsApplied && !settingsDefaultsErrorMessage ? (
        <SettingsDefaultsLoadingState />
      ) : null}
      {settingsDefaultsErrorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{settingsDefaultsErrorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {settingsDefaultsApplied && !settingsDefaultsErrorMessage ? (
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit}
        >
          <FieldGroup className="gap-4">
            <LargeFileUploadField
              accept="image/jpeg,image/png,image/webp"
              autoFocus
              disabled={saving}
              error={imageUploadError ?? formErrors.sourceUploadId ?? null}
              id="page-image"
              label="Source image"
              onFileSelected={(file, options) =>
                handleSourceFileChange(file, options)
              }
              onUploadingChange={setIsImageUploading}
            />
            <TextField
              id="page-name"
              label="Name"
              error={formErrors.name}
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
                setFormErrors((currentFormErrors) => ({
                  ...currentFormErrors,
                  name: undefined,
                }));
              }}
            />
            <FormSection title="AI Processing">
              <PageSettingsFields
                errors={formErrors}
                allowInherit={false}
                aiProcessingEnabled={aiProcessingEnabled}
                sourceLanguages={sourceLanguages}
                sourceLanguagesCustomFallback=""
                targetLanguage={targetLanguage}
                targetLanguageCustomFallback=""
                vocabularyEnabled={vocabularyEnabled}
                onAiProcessingEnabledChange={setAiProcessingEnabled}
                onSourceLanguagesChange={(value) => {
                  setSourceLanguages(value);
                  setFormErrors((currentFormErrors) => ({
                    ...currentFormErrors,
                    sourceLanguages: undefined,
                  }));
                }}
                onTargetLanguageChange={(value) => {
                  setTargetLanguage(value);
                  setFormErrors((currentFormErrors) => ({
                    ...currentFormErrors,
                    targetLanguage: undefined,
                  }));
                }}
                onVocabularyEnabledChange={setVocabularyEnabled}
              />
            </FormSection>
          </FieldGroup>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="flex-col gap-3 sm:items-center sm:justify-between">
            <FolderLocationStrip value={parentLabel} />
            <Button type="submit" disabled={saving || isImageUploading}>
              {saving ? "Saving" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </>
  );
}

function SettingsDefaultsLoadingState() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex items-start gap-3 py-8 text-sm"
    >
      <Spinner className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">Loading defaults</p>
        <p className="text-muted-foreground">
          The form will be available after settings are loaded.
        </p>
      </div>
    </div>
  );
}

function FormSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <FieldSet className="gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <FieldLegend className="mb-0 text-sm text-muted-foreground">
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}

export function PageSettingsFields({
  allowInherit,
  errors,
  aiProcessingEnabled,
  sourceLanguages,
  sourceLanguagesCustomFallback,
  targetLanguage,
  targetLanguageCustomFallback,
  vocabularyEnabled,
  onAiProcessingEnabledChange,
  onSourceLanguagesChange,
  onTargetLanguageChange,
  onVocabularyEnabledChange,
}: {
  allowInherit: boolean;
  errors: PageSettingsFieldErrors;
  aiProcessingEnabled: boolean | null;
  sourceLanguages: string | null;
  sourceLanguagesCustomFallback: string;
  targetLanguage: string | null;
  targetLanguageCustomFallback: string;
  vocabularyEnabled: boolean | null;
  onAiProcessingEnabledChange: (value: boolean | null) => void;
  onSourceLanguagesChange: (value: string | null) => void;
  onTargetLanguageChange: (value: string | null) => void;
  onVocabularyEnabledChange: (value: boolean | null) => void;
}) {
  return (
    <FieldGroup className="gap-4">
      <AiProcessingFeatureField
        allowInherit={allowInherit}
        id="page-ai-processing"
        aiProcessingEnabled={aiProcessingEnabled}
        onAiProcessingEnabledChange={onAiProcessingEnabledChange}
      />
      <InheritableTextField
        allowInherit={allowInherit}
        customValueFallback={sourceLanguagesCustomFallback}
        id="page-source-languages"
        label="Source languages"
        error={errors.sourceLanguages}
        value={sourceLanguages}
        placeholder="ja, en"
        onChange={onSourceLanguagesChange}
      />
      <InheritableTextField
        allowInherit={allowInherit}
        customValueFallback={targetLanguageCustomFallback}
        id="page-target-language"
        label="Target language"
        error={errors.targetLanguage}
        value={targetLanguage}
        placeholder="ru"
        onChange={onTargetLanguageChange}
      />
      <VocabularyFeatureField
        allowInherit={allowInherit}
        id="page-vocabulary"
        vocabularyEnabled={vocabularyEnabled}
        onVocabularyEnabledChange={onVocabularyEnabledChange}
      />
    </FieldGroup>
  );
}

function InheritableTextField({
  allowInherit,
  customValueFallback,
  error,
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  allowInherit: boolean;
  customValueFallback: string;
  error: string | undefined;
  id: string;
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  if (!allowInherit) {
    return (
      <TextField
        id={id}
        label={label}
        error={error}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <FieldGroup className="gap-2">
      <Field>
        <FieldLabel htmlFor={`${id}-mode`}>{label}</FieldLabel>
        <Select
          value={
            value === null ? INHERIT_SETTINGS_VALUE : CUSTOM_SETTINGS_VALUE
          }
          onValueChange={(nextValue) => {
            onChange(
              nextValue === INHERIT_SETTINGS_VALUE
                ? null
                : (value ?? customValueFallback),
            );
          }}
        >
          <SelectTrigger id={`${id}-mode`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT_SETTINGS_VALUE}>
              Inherit from book
            </SelectItem>
            <SelectItem value={CUSTOM_SETTINGS_VALUE}>Custom</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {value !== null ? (
        <TextField
          id={id}
          label={`${label} value`}
          error={error}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      ) : null}
    </FieldGroup>
  );
}

function validatePageForm(input: {
  canInheritSettings: boolean;
  sourceUploadId: string | null;
  sourceLanguages: string | null;
  targetLanguage: string | null;
  name: string;
}): PageFormErrors {
  const errors: PageFormErrors = {};

  if (!input.sourceUploadId) {
    errors.sourceUploadId = "Upload a source image before saving.";
  }

  if (!input.name.trim()) {
    errors.name = "Name is required.";
  }

  Object.assign(errors, validatePageSettingsFields(input));

  return errors;
}

export function validatePageSettingsFields(input: {
  canInheritSettings: boolean;
  sourceLanguages: string | null;
  targetLanguage: string | null;
}): PageSettingsFieldErrors {
  const errors: PageSettingsFieldErrors = {};

  if (input.sourceLanguages === null && !input.canInheritSettings) {
    errors.sourceLanguages = "Source languages are required.";
  } else if (input.sourceLanguages !== null && !input.sourceLanguages.trim()) {
    errors.sourceLanguages = "Source languages are required.";
  }

  if (input.targetLanguage === null && !input.canInheritSettings) {
    errors.targetLanguage = "Target language is required.";
  } else if (input.targetLanguage !== null && !input.targetLanguage.trim()) {
    errors.targetLanguage = "Target language is required.";
  }

  return errors;
}

export function hasPageFormErrors(
  errors: PageFormErrors | PageSettingsFieldErrors,
): boolean {
  return Object.values(errors).some(Boolean);
}

export function buildPageSettingsInput(
  sourceLanguages: string | null,
  targetLanguage: string | null,
  aiProcessingEnabled: boolean | null,
  vocabularyEnabled: boolean | null,
): PageSettingsInput {
  const settings: PageSettingsInput = {
    aiProcessingEnabled,
    vocabularyEnabled,
  };

  if (sourceLanguages === null) {
    settings.translationSourceLanguages = null;
  } else {
    const parsedLanguages = sourceLanguages
      .split(",")
      .map((language) => language.trim())
      .filter((language) => language.length > 0);

    if (parsedLanguages.length > 0) {
      settings.translationSourceLanguages = parsedLanguages;
    }
  }

  if (targetLanguage === null) {
    settings.translationTargetLanguage = null;
  } else if (targetLanguage.trim().length > 0) {
    settings.translationTargetLanguage = targetLanguage.trim();
  }

  return settings;
}
