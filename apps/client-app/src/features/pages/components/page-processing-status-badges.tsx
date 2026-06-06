import { AiProcessingStatus, OcrStatus } from "@/graphql/generated/graphql";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  AiProcessingDisabledBadge,
  VocabularyDisabledBadge,
} from "@/features/processing-settings/components/processing-disabled-badges";

type PageProcessingStatusBadgesProps = {
  aiProcessingStatus: AiProcessingStatus;
  aiProcessingEnabled: boolean;
  className?: string;
  ocrStatus: OcrStatus;
  vocabularyEnabled: boolean;
};

type StatusBadgeVariant = "outline" | "secondary" | "success";

export function PageProcessingStatusBadges({
  aiProcessingStatus,
  aiProcessingEnabled,
  className,
  ocrStatus,
  vocabularyEnabled,
}: PageProcessingStatusBadgesProps) {
  const aiBadge = getAiProcessingBadge(aiProcessingStatus);
  const vocabularyBadge = vocabularyEnabled
    ? getVocabularyBadge(aiProcessingStatus)
    : null;
  const showVocabularyDisabledBadge =
    !vocabularyEnabled && isVocabularyStatusVisible(aiProcessingStatus);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Badge variant={getOcrStatusVariant(ocrStatus)}>
        {getOcrStatusLabel(ocrStatus)}
      </Badge>
      <Badge variant={aiBadge.variant}>{aiBadge.label}</Badge>
      {vocabularyBadge ? (
        <Badge
          className={vocabularyBadge.className}
          variant={vocabularyBadge.variant}
        >
          {vocabularyBadge.label}
        </Badge>
      ) : null}
      {showVocabularyDisabledBadge ? <VocabularyDisabledBadge /> : null}
      {!aiProcessingEnabled ? <AiProcessingDisabledBadge /> : null}
    </div>
  );
}

function getOcrStatusLabel(status: OcrStatus): string {
  switch (status) {
    case OcrStatus.Pending:
      return "OCR Pending";
    case OcrStatus.Processing:
      return "OCR Processing";
    case OcrStatus.Complete:
      return "OCR Complete";
  }
}

function getOcrStatusVariant(status: OcrStatus): StatusBadgeVariant {
  switch (status) {
    case OcrStatus.Processing:
      return "secondary";
    case OcrStatus.Complete:
      return "success";
    case OcrStatus.Pending:
      return "outline";
  }
}

function getAiProcessingBadge(status: AiProcessingStatus): {
  label: string;
  variant: StatusBadgeVariant;
} {
  switch (status) {
    case AiProcessingStatus.CleanUpPending:
      return { label: "Clean up pending", variant: "outline" };
    case AiProcessingStatus.CleanUpProcessing:
      return { label: "Clean up processing", variant: "secondary" };
    case AiProcessingStatus.SplitPending:
      return { label: "Split pending", variant: "outline" };
    case AiProcessingStatus.Splitting:
      return { label: "Splitting", variant: "secondary" };
    case AiProcessingStatus.TranslationPending:
      return { label: "Translation pending", variant: "outline" };
    case AiProcessingStatus.Translating:
      return { label: "Translating", variant: "secondary" };
    case AiProcessingStatus.VocabularyPending:
    case AiProcessingStatus.VocabularyProcessing:
    case AiProcessingStatus.Complete:
      return { label: "Translation complete", variant: "success" };
  }
}

function getVocabularyBadge(aiProcessingStatus: AiProcessingStatus): {
  className?: string;
  label: string;
  variant: StatusBadgeVariant;
} | null {
  switch (aiProcessingStatus) {
    case AiProcessingStatus.VocabularyPending:
      return { label: "Vocab pending", variant: "outline" };
    case AiProcessingStatus.VocabularyProcessing:
      return { label: "Vocab processing", variant: "secondary" };
    case AiProcessingStatus.Complete:
      return { label: "Vocab complete", variant: "success" };
    case AiProcessingStatus.CleanUpPending:
    case AiProcessingStatus.CleanUpProcessing:
    case AiProcessingStatus.SplitPending:
    case AiProcessingStatus.Splitting:
    case AiProcessingStatus.TranslationPending:
    case AiProcessingStatus.Translating:
      return null;
  }
}

function isVocabularyStatusVisible(status: AiProcessingStatus): boolean {
  switch (status) {
    case AiProcessingStatus.VocabularyPending:
    case AiProcessingStatus.VocabularyProcessing:
    case AiProcessingStatus.Complete:
      return true;
    case AiProcessingStatus.CleanUpPending:
    case AiProcessingStatus.CleanUpProcessing:
    case AiProcessingStatus.SplitPending:
    case AiProcessingStatus.Splitting:
    case AiProcessingStatus.TranslationPending:
    case AiProcessingStatus.Translating:
      return false;
  }
}
