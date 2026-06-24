import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@apollo/client/react";
import {
  type BookListFieldsFragment,
  type BookQuery,
  UpdateBookDocument,
} from "@/graphql/generated/graphql";
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
  BookSettingsFields,
  buildBookSettingsInput,
  hasBookFormErrors,
  type BookSettingsFieldErrors,
  validateBookSettingsFields,
} from "./book-form-dialog";

type BookOptionsDialogBook = Pick<
  BookListFieldsFragment | BookQuery["book"],
  "path" | "settings"
>;

type BookOptionsDialogProps = {
  book: BookOptionsDialogBook;
  open?: boolean;
  trigger?: ReactNode | null;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (path?: string) => Promise<void> | void;
};

export function BookOptionsDialog({
  book,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: BookOptionsDialogProps) {
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
          {trigger ?? <Button>Edit options</Button>}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <BookOptionsContent
            book={book}
            onClose={() => handleOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BookOptionsContent({
  book,
  onClose,
  onCompleted,
}: {
  book: BookOptionsDialogBook;
  onClose: () => void;
  onCompleted: BookOptionsDialogProps["onCompleted"];
}) {
  const [sourceLanguages, setSourceLanguages] = useState(
    book.settings.translationSourceLanguages.join(", "),
  );
  const [targetLanguage, setTargetLanguage] = useState(
    book.settings.translationTargetLanguage,
  );
  const [aiProcessingEnabled, setAiProcessingEnabled] = useState(
    book.settings.aiProcessingEnabled,
  );
  const [vocabularyEnabled, setVocabularyEnabled] = useState(
    book.settings.vocabularyEnabled,
  );
  const [formErrors, setFormErrors] = useState<BookSettingsFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updateBook, updateState] = useMutation(UpdateBookDocument);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const nextFormErrors = validateBookSettingsFields({
      sourceLanguages,
      targetLanguage,
    });

    if (hasBookFormErrors(nextFormErrors)) {
      setFormErrors(nextFormErrors);
      return;
    }

    setFormErrors({});

    try {
      const result = await updateBook({
        variables: {
          path: book.path,
          input: {
            settings: buildBookSettingsInput(
              sourceLanguages,
              targetLanguage,
              aiProcessingEnabled,
              vocabularyEnabled,
            ),
          },
        },
      });

      await onCompleted?.(result.data?.updateBook.path);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b px-4 py-4 pr-12">
        <DialogTitle>Edit Book Options</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
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
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="submit" disabled={updateState.loading}>
            {updateState.loading ? "Saving" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
