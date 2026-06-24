import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Plus } from "lucide-react";
import {
  formatUploadFileSize,
  OCR_BOOK_ALLOWED_MIME_TYPES,
  OCR_BOOK_UPLOAD_MAX_FILE_SIZE_BYTES,
} from "@yomika/shared";
import {
  type BookSettingsInput,
  CreateBookDocument,
  LibrarySettingsDefaultsDocument,
  StartRunnerDocument,
} from "@/graphql/generated/graphql";
import {
  FolderLocationStrip,
  ROOT_FOLDER_LABEL,
} from "@/features/library/components/folder-location-info";
import { AiProcessingFeatureField } from "@/features/processing-settings/components/ai-processing-feature-field";
import { VocabularyFeatureField } from "@/features/processing-settings/components/vocabulary-feature-field";
import { uploadBookPdf } from "@/features/uploads/api/upload-client";
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
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { getNameFromFileName } from "@/lib/file-name";

type BookFormDialogProps = {
  defaultParentPath?: string | null;
  defaultParentLabel?: string | null;
  open?: boolean;
  trigger?: ReactNode | null;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (path?: string) => Promise<void> | void;
};

type BookFormErrors = {
  sourceUploadId?: string | undefined;
  name?: string | undefined;
} & BookSettingsFieldErrors;

export type BookSettingsFieldErrors = {
  sourceLanguages?: string | undefined;
  targetLanguage?: string | undefined;
};

type BookFormContentProps = {
  defaultParentPath: string | null | undefined;
  defaultParentLabel: string | null | undefined;
  onClose: () => void;
  onCompleted: ((path?: string) => Promise<void> | void) | undefined;
};

function validateBookPdf(file: File): string | null {
  if (
    !OCR_BOOK_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof OCR_BOOK_ALLOWED_MIME_TYPES)[number],
    ) &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return "Select a PDF file.";
  }

  if (file.size > OCR_BOOK_UPLOAD_MAX_FILE_SIZE_BYTES) {
    return `PDF files must be ${formatUploadFileSize(OCR_BOOK_UPLOAD_MAX_FILE_SIZE_BYTES)} or smaller.`;
  }

  return null;
}

export function BookFormDialog({
  defaultParentPath,
  defaultParentLabel,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: BookFormDialogProps) {
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
              <Plus />
              New Book
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <BookFormContent
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

function BookFormContent({
  defaultParentPath,
  defaultParentLabel,
  onClose,
  onCompleted,
}: BookFormContentProps) {
  const [name, setName] = useState("");
  const [sourceLanguages, setSourceLanguages] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [aiProcessingEnabled, setAiProcessingEnabled] = useState(true);
  const [vocabularyEnabled, setVocabularyEnabled] = useState(false);
  const [settingsDefaultsApplied, setSettingsDefaultsApplied] = useState(false);
  const [sourceUploadId, setSourceUploadId] = useState<string | null>(null);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<BookFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createBook, createState] = useMutation(CreateBookDocument);
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
      currentSourceLanguages.trim()
        ? currentSourceLanguages
        : defaults.translationSourceLanguages.join(", "),
    );
    setTargetLanguage((currentTargetLanguage) =>
      currentTargetLanguage.trim()
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
    const nextFormErrors = validateBookForm({
      sourceUploadId,
      sourceLanguages,
      targetLanguage,
      name,
    });

    if (hasBookFormErrors(nextFormErrors)) {
      setFormErrors(nextFormErrors);
      return;
    }

    setFormErrors({});

    try {
      const settings = buildBookSettingsInput(
        sourceLanguages,
        targetLanguage,
        aiProcessingEnabled,
        vocabularyEnabled,
      );
      const result = await createBook({
        variables: {
          input: {
            name,
            parentPath,
            sourceUploadId: sourceUploadId!,
            settings,
          },
        },
      });
      const completedPath = result.data?.createBook.path;
      void startRunner().catch(() => undefined);

      await onCompleted?.(completedPath);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSourceFileChange(
    file: File,
    options: Parameters<typeof uploadBookPdf>[1],
  ) {
    const validationError = validateBookPdf(file);

    if (validationError) {
      setPdfUploadError(validationError);
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
    setPdfUploadError(null);
    setSourceUploadId(null);
    setFormErrors((currentFormErrors) => ({
      ...currentFormErrors,
      sourceUploadId: undefined,
    }));

    try {
      const uploadId = await uploadBookPdf(file, options);

      setSourceUploadId(uploadId);
      setPdfUploadError(null);
      setFormErrors((currentFormErrors) => ({
        ...currentFormErrors,
        sourceUploadId: undefined,
      }));

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The upload request failed.";

      setPdfUploadError(message);
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
        <DialogTitle>New Book</DialogTitle>
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
              accept="application/pdf,.pdf"
              disabled={saving}
              error={pdfUploadError ?? formErrors.sourceUploadId ?? null}
              id="book-pdf"
              label="Source PDF"
              onFileSelected={(file, options) =>
                handleSourceFileChange(file, options)
              }
              onUploadingChange={setIsPdfUploading}
            />
            <TextField
              id="book-name"
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
              <BookSettingsFields
                errors={formErrors}
                aiProcessingEnabled={aiProcessingEnabled}
                sourceLanguages={sourceLanguages}
                targetLanguage={targetLanguage}
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
            <Button type="submit" disabled={saving || isPdfUploading}>
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

export function BookSettingsFields({
  errors,
  aiProcessingEnabled,
  sourceLanguages,
  targetLanguage,
  vocabularyEnabled,
  onAiProcessingEnabledChange,
  onSourceLanguagesChange,
  onTargetLanguageChange,
  onVocabularyEnabledChange,
}: {
  errors: BookSettingsFieldErrors;
  aiProcessingEnabled: boolean;
  sourceLanguages: string;
  targetLanguage: string;
  vocabularyEnabled: boolean;
  onAiProcessingEnabledChange: (value: boolean) => void;
  onSourceLanguagesChange: (value: string) => void;
  onTargetLanguageChange: (value: string) => void;
  onVocabularyEnabledChange: (value: boolean) => void;
}) {
  return (
    <FieldGroup className="gap-4">
      <AiProcessingFeatureField
        id="book-ai-processing"
        aiProcessingEnabled={aiProcessingEnabled}
        onAiProcessingEnabledChange={(value) => {
          onAiProcessingEnabledChange(value ?? true);
        }}
      />
      <TextField
        id="book-source-languages"
        label="Source languages"
        error={errors.sourceLanguages}
        value={sourceLanguages}
        placeholder="ja, en"
        onChange={(event) => onSourceLanguagesChange(event.currentTarget.value)}
      />
      <TextField
        id="book-target-language"
        label="Target language"
        error={errors.targetLanguage}
        value={targetLanguage}
        placeholder="ru"
        onChange={(event) => onTargetLanguageChange(event.currentTarget.value)}
      />
      <VocabularyFeatureField
        id="book-vocabulary"
        vocabularyEnabled={vocabularyEnabled}
        onVocabularyEnabledChange={(value) => {
          onVocabularyEnabledChange(value ?? false);
        }}
      />
    </FieldGroup>
  );
}

function validateBookForm(input: {
  sourceUploadId: string | null;
  sourceLanguages: string;
  targetLanguage: string;
  name: string;
}): BookFormErrors {
  const errors: BookFormErrors = {};

  if (!input.sourceUploadId) {
    errors.sourceUploadId = "Upload a source PDF before saving.";
  }

  if (!input.name.trim()) {
    errors.name = "Name is required.";
  }

  Object.assign(errors, validateBookSettingsFields(input));

  return errors;
}

export function validateBookSettingsFields(input: {
  sourceLanguages: string;
  targetLanguage: string;
}): BookSettingsFieldErrors {
  const errors: BookSettingsFieldErrors = {};

  if (!input.sourceLanguages.trim()) {
    errors.sourceLanguages = "Source languages are required.";
  }

  if (!input.targetLanguage.trim()) {
    errors.targetLanguage = "Target language is required.";
  }

  return errors;
}

export function hasBookFormErrors(
  errors: BookFormErrors | BookSettingsFieldErrors,
): boolean {
  return Object.values(errors).some(Boolean);
}

export function buildBookSettingsInput(
  sourceLanguages: string,
  targetLanguage: string,
  aiProcessingEnabled: boolean,
  vocabularyEnabled: boolean,
): BookSettingsInput {
  const settings: BookSettingsInput = {
    aiProcessingEnabled,
    vocabularyEnabled,
  };
  const parsedLanguages = sourceLanguages
    .split(",")
    .map((language) => language.trim())
    .filter((language) => language.length > 0);

  if (parsedLanguages.length > 0) {
    settings.translationSourceLanguages = parsedLanguages;
  }

  if (targetLanguage.trim().length > 0) {
    settings.translationTargetLanguage = targetLanguage.trim();
  }

  return settings;
}
