import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@apollo/client/react";
import {
  AiProcessingStatus,
  OcrStatus,
  UpdatePageDocument,
  type PageListFieldsFragment,
  type PageQuery,
} from "@/graphql/generated/graphql";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatStatus } from "@/components/common/status-badges";

type PageAiStatusDialogPage = Pick<
  NonNullable<PageQuery["page"]> | PageListFieldsFragment,
  "path" | "ocrStatus" | "aiProcessingStatus"
>;

type PageAiStatusDialogProps = {
  open: boolean;
  page: PageAiStatusDialogPage;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => Promise<void> | void;
};

type ProcessingStatusOption = {
  value: string;
  label: string;
  ocrStatus: OcrStatus;
  aiProcessingStatus: AiProcessingStatus;
};

const PROCESSING_STATUS_OPTIONS = [
  {
    value: "ocr-pending",
    label: "OCR pending",
    ocrStatus: OcrStatus.Pending,
    aiProcessingStatus: AiProcessingStatus.CleanUpPending,
  },
  {
    value: "cleanup-pending",
    label: "Cleanup pending",
    ocrStatus: OcrStatus.Complete,
    aiProcessingStatus: AiProcessingStatus.CleanUpPending,
  },
  {
    value: "split-pending",
    label: "Split pending",
    ocrStatus: OcrStatus.Complete,
    aiProcessingStatus: AiProcessingStatus.SplitPending,
  },
  {
    value: "translation-pending",
    label: "Translation pending",
    ocrStatus: OcrStatus.Complete,
    aiProcessingStatus: AiProcessingStatus.TranslationPending,
  },
  {
    value: "vocabulary-pending",
    label: "Vocabulary pending",
    ocrStatus: OcrStatus.Complete,
    aiProcessingStatus: AiProcessingStatus.VocabularyPending,
  },
  {
    value: "complete",
    label: "Complete",
    ocrStatus: OcrStatus.Complete,
    aiProcessingStatus: AiProcessingStatus.Complete,
  },
] as const satisfies readonly ProcessingStatusOption[];

export function PageAiStatusDialog({
  open,
  page,
  onOpenChange,
  onCompleted,
}: PageAiStatusDialogProps) {
  const [selectedProcessingStatus, setSelectedProcessingStatus] = useState(
    getProcessingStatusOptionValue(page),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatePage, updateState] = useMutation(UpdatePageDocument);
  const selectedOption = getProcessingStatusOptionByValue(
    selectedProcessingStatus,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedProcessingStatus(getProcessingStatusOptionValue(page));
    setErrorMessage(null);
  }, [open, page.aiProcessingStatus, page.ocrStatus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await updatePage({
        variables: {
          path: page.path,
          input: {
            ocrStatus: selectedOption.ocrStatus,
            aiProcessingStatus: selectedOption.aiProcessingStatus,
          },
        },
      });

      await onCompleted?.();
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b px-4 py-4 pr-12">
          <DialogTitle>Edit status</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit}
        >
          <Field>
            <FieldLabel htmlFor="page-processing-status">
              Processing status
            </FieldLabel>
            <Select
              value={selectedProcessingStatus}
              onValueChange={(value) => {
                setSelectedProcessingStatus(value);
              }}
            >
              <SelectTrigger id="page-processing-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROCESSING_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              OCR: {formatStatus(selectedOption.ocrStatus)} · AI:{" "}
              {formatStatus(selectedOption.aiProcessingStatus)}
            </p>
          </Field>
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
      </DialogContent>
    </Dialog>
  );
}

function getProcessingStatusOptionValue(page: PageAiStatusDialogPage): string {
  const matchedOption = PROCESSING_STATUS_OPTIONS.find(
    (option) =>
      option.ocrStatus === page.ocrStatus &&
      option.aiProcessingStatus === page.aiProcessingStatus,
  );

  if (matchedOption) {
    return matchedOption.value;
  }

  if (page.ocrStatus !== OcrStatus.Complete) {
    return "ocr-pending";
  }

  return getProcessingStatusOptionForAiStatus(page.aiProcessingStatus).value;
}

function getProcessingStatusOptionByValue(
  value: string,
): ProcessingStatusOption {
  return (
    PROCESSING_STATUS_OPTIONS.find((option) => option.value === value) ??
    PROCESSING_STATUS_OPTIONS[0]
  );
}

function getProcessingStatusOptionForAiStatus(
  status: AiProcessingStatus,
): ProcessingStatusOption {
  switch (status) {
    case AiProcessingStatus.CleanUpPending:
    case AiProcessingStatus.CleanUpProcessing:
      return getProcessingStatusOptionByValue("cleanup-pending");
    case AiProcessingStatus.SplitPending:
    case AiProcessingStatus.Splitting:
      return getProcessingStatusOptionByValue("split-pending");
    case AiProcessingStatus.TranslationPending:
    case AiProcessingStatus.Translating:
      return getProcessingStatusOptionByValue("translation-pending");
    case AiProcessingStatus.VocabularyPending:
    case AiProcessingStatus.VocabularyProcessing:
      return getProcessingStatusOptionByValue("vocabulary-pending");
    case AiProcessingStatus.Complete:
      return getProcessingStatusOptionByValue("complete");
  }
}
