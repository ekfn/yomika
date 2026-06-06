import { PageProcessingStatusBadges } from "@/features/pages/components/page-processing-status-badges";
import { PageDetailSideCard } from "./page-detail-side-card";
import { PageOcrPreviewCard } from "./page-ocr-preview-card";
import type { PageDetail, PageImageDimensions } from "./types";

type PageInfoTabProps = {
  page: PageDetail;
  sourceImageUrl: string;
  sourceImageDimensions: PageImageDimensions | null;
};

export function PageInfoTab({
  page,
  sourceImageUrl,
  sourceImageDimensions,
}: PageInfoTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(540px,50%)]">
      <PageOcrPreviewCard
        sourceImageUrl={sourceImageUrl}
        sourceImageDimensions={sourceImageDimensions}
        blocks={[]}
        selectedBlockId={null}
        blockVisibility="all"
        onBlockClick={() => undefined}
      />

      <PageDetailSideCard
        title="Page details"
        contentClassName="grid gap-4 text-sm"
      >
        <PageProcessingStatusBadges
          ocrStatus={page.ocrStatus}
          aiProcessingStatus={page.aiProcessingStatus}
          aiProcessingEnabled={page.effectiveSettings.aiProcessingEnabled}
          vocabularyEnabled={page.effectiveSettings.vocabularyEnabled}
        />
        <DetailsRow
          label="Source"
          value={formatInheritedSetting(
            page.settings.translationSourceLanguages,
            page.effectiveSettings.translationSourceLanguages.join(", "),
            (value) => value.join(", "),
          )}
        />
        <DetailsRow
          label="Target"
          value={formatInheritedSetting(
            page.settings.translationTargetLanguage,
            page.effectiveSettings.translationTargetLanguage,
          )}
        />
        <DetailsRow
          label="AI processing"
          value={formatInheritedSetting(
            page.settings.aiProcessingEnabled,
            formatBooleanSetting(page.effectiveSettings.aiProcessingEnabled),
            formatBooleanSetting,
          )}
        />
        <DetailsRow
          label="Vocabulary"
          value={formatInheritedSetting(
            page.settings.vocabularyEnabled,
            formatBooleanSetting(page.effectiveSettings.vocabularyEnabled),
            formatBooleanSetting,
          )}
        />
        <DetailsRow
          label="Image"
          value={
            sourceImageDimensions
              ? `${sourceImageDimensions.width} x ${sourceImageDimensions.height}`
              : "n/a"
          }
        />
        <div className="grid gap-2 border-t pt-4">
          <span className="text-muted-foreground">OCR raw JSON</span>
          {page.ocrRawJson ? (
            <p className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-xs leading-relaxed">
              {page.ocrRawJson}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Raw OCR data is not available yet.
            </p>
          )}
        </div>
      </PageDetailSideCard>
    </div>
  );
}

function formatBooleanSetting(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}

function formatInheritedSetting<TValue>(
  value: TValue | null | undefined,
  effectiveValue: string,
  formatValue: (value: TValue) => string = String,
): string {
  if (value == null) {
    return `Inherit from book (${effectiveValue})`;
  }

  return formatValue(value);
}

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
