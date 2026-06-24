import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@apollo/client/react";
import {
  type PageListFieldsFragment,
  type PageQuery,
  UpdatePageDocument,
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
  buildPageSettingsInput,
  getInitialPageAiProcessingEnabled,
  getInitialPageSourceLanguages,
  getInitialPageTargetLanguage,
  getInitialPageVocabularyEnabled,
  hasPageFormErrors,
  PageSettingsFields,
  type PageSettingsFieldErrors,
  validatePageSettingsFields,
} from "./page-form-dialog";

type PageOptionsDialogPage = Pick<
  NonNullable<PageQuery["page"]> | PageListFieldsFragment,
  "path" | "bookPath" | "settings" | "effectiveSettings"
>;

type PageOptionsDialogProps = {
  page: PageOptionsDialogPage;
  open?: boolean;
  trigger?: ReactNode | null;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (path?: string) => Promise<void> | void;
};

export function PageOptionsDialog({
  page,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: PageOptionsDialogProps) {
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
          <PageOptionsContent
            page={page}
            onClose={() => handleOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PageOptionsContent({
  page,
  onClose,
  onCompleted,
}: {
  page: PageOptionsDialogPage;
  onClose: () => void;
  onCompleted: PageOptionsDialogProps["onCompleted"];
}) {
  const allowInherit = Boolean(page.bookPath);
  const [sourceLanguages, setSourceLanguages] = useState<string | null>(
    getInitialPageSourceLanguages(page),
  );
  const [targetLanguage, setTargetLanguage] = useState<string | null>(
    getInitialPageTargetLanguage(page),
  );
  const [aiProcessingEnabled, setAiProcessingEnabled] = useState<
    boolean | null
  >(getInitialPageAiProcessingEnabled(page));
  const [vocabularyEnabled, setVocabularyEnabled] = useState<boolean | null>(
    getInitialPageVocabularyEnabled(page),
  );
  const [formErrors, setFormErrors] = useState<PageSettingsFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatePage, updateState] = useMutation(UpdatePageDocument);
  const sourceLanguagesCustomFallback =
    page.effectiveSettings.translationSourceLanguages.join(", ");
  const targetLanguageCustomFallback =
    page.effectiveSettings.translationTargetLanguage;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const nextFormErrors = validatePageSettingsFields({
      canInheritSettings: allowInherit,
      sourceLanguages,
      targetLanguage,
    });

    if (hasPageFormErrors(nextFormErrors)) {
      setFormErrors(nextFormErrors);
      return;
    }

    setFormErrors({});

    try {
      const result = await updatePage({
        variables: {
          path: page.path,
          input: {
            settings: buildPageSettingsInput(
              sourceLanguages,
              targetLanguage,
              aiProcessingEnabled,
              vocabularyEnabled,
            ),
          },
        },
      });

      await onCompleted?.(result.data?.updatePage.path);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b px-4 py-4 pr-12">
        <DialogTitle>Edit Page Options</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        <PageSettingsFields
          allowInherit={allowInherit}
          errors={formErrors}
          aiProcessingEnabled={aiProcessingEnabled}
          sourceLanguages={sourceLanguages}
          sourceLanguagesCustomFallback={sourceLanguagesCustomFallback}
          targetLanguage={targetLanguage}
          targetLanguageCustomFallback={targetLanguageCustomFallback}
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
