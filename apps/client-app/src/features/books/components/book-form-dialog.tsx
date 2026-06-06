import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Pencil, Plus } from "lucide-react";
import {
  formatUploadFileSize,
  getBookDisplayName,
  getContainingFolderPath,
  OCR_BOOK_ALLOWED_MIME_TYPES,
  OCR_BOOK_UPLOAD_MAX_FILE_SIZE_BYTES,
} from "@yomika/shared";
import {
  type BookListFieldsFragment,
  type BookSettingsInput,
  CreateBookDocument,
  LibrarySettingsDefaultsDocument,
  StartRunnerDocument,
  UpdateBookDocument,
} from "@/graphql/generated/graphql";
import {
  FolderLocationStrip,
  getFolderLocationLabel,
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
  book?: BookListFieldsFragment;
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
  sourceLanguages?: string | undefined;
  targetLanguage?: string | undefined;
};

type BookFormContentProps = {
  book: BookListFieldsFragment | undefined;
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
  book,
  defaultParentPath,
  defaultParentLabel,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: BookFormDialogProps) {
  const isEditing = Boolean(book);
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
            <Button variant={isEditing ? "outline" : "default"}>
              {isEditing ? <Pencil /> : <Plus />}
              {isEditing ? "Edit Book" : "New Book"}
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <BookFormContent
            book={book}
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
  book,
  defaultParentPath,
  defaultParentLabel,
  onClose,
  onCompleted,
}: BookFormContentProps) {
  const isEditing = Boolean(book);
  const [name, setName] = useState(book ? getBookDisplayName(book.path) : "");
  const [sourceLanguages, setSourceLanguages] = useState(
    book?.settings.translationSourceLanguages.join(", ") ?? "",
  );
  const [targetLanguage, setTargetLanguage] = useState(
    book?.settings.translationTargetLanguage ?? "",
  );
  const [aiProcessingEnabled, setAiProcessingEnabled] = useState(
    book?.settings.aiProcessingEnabled ?? true,
  );
  const [vocabularyEnabled, setVocabularyEnabled] = useState(
    book?.settings.vocabularyEnabled ?? false,
  );
  const [settingsDefaultsApplied, setSettingsDefaultsApplied] =
    useState(isEditing);
  const [sourceUploadId, setSourceUploadId] = useState<string | null>(null);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<BookFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createBook, createState] = useMutation(CreateBookDocument);
  const [startRunner] = useMutation(StartRunnerDocument);
  const [updateBook, updateState] = useMutation(UpdateBookDocument);
  const defaultsQuery = useQuery(LibrarySettingsDefaultsDocument, {
    skip: isEditing,
  });
  const saving = createState.loading || updateState.loading;
  const settingsDefaultsErrorMessage =
    !isEditing && defaultsQuery.error ? defaultsQuery.error.message : null;
  const parentPath = book
    ? getContainingFolderPath(book.path)
    : (defaultParentPath ?? null);
  const parentLabel = book
    ? getFolderLocationLabel(parentPath)
    : (defaultParentLabel ?? ROOT_FOLDER_LABEL);

  useEffect(() => {
    if (isEditing) {
      setSettingsDefaultsApplied(true);
      return;
    }

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
  }, [defaultsQuery.data, isEditing]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const nextFormErrors = validateBookForm({
      isEditing,
      sourceUploadId,
      sourceLanguages,
      targetLanguage,
      name,
    });

    if (hasFormErrors(nextFormErrors)) {
      setFormErrors(nextFormErrors);
      return;
    }

    setFormErrors({});

    try {
      const settings = buildSettingsInput(
        sourceLanguages,
        targetLanguage,
        aiProcessingEnabled,
        vocabularyEnabled,
      );
      let completedPath: string | undefined;

      if (book) {
        const result = await updateBook({
          variables: {
            path: book.path,
            input: {
              name,
              settings,
            },
          },
        });
        completedPath = result.data?.updateBook.path;
      } else {
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
        completedPath = result.data?.createBook.path;
        void startRunner().catch(() => undefined);
      }

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
        <DialogTitle>{isEditing ? "Edit Book" : "New Book"}</DialogTitle>
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
            {!isEditing ? (
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
            ) : null}
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
              <SettingsFields
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

function SettingsFields({
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
  errors: Pick<BookFormErrors, "sourceLanguages" | "targetLanguage">;
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
  isEditing: boolean;
  sourceUploadId: string | null;
  sourceLanguages: string;
  targetLanguage: string;
  name: string;
}): BookFormErrors {
  const errors: BookFormErrors = {};

  if (!input.isEditing && !input.sourceUploadId) {
    errors.sourceUploadId = "Upload a source PDF before saving.";
  }

  if (!input.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!input.sourceLanguages.trim()) {
    errors.sourceLanguages = "Source languages are required.";
  }

  if (!input.targetLanguage.trim()) {
    errors.targetLanguage = "Target language is required.";
  }

  return errors;
}

function hasFormErrors(errors: BookFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

function buildSettingsInput(
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
