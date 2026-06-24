import { useEffect, useState } from "react";
import {
  CaptionsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LanguagesIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  LOCAL_STORAGE_KEYS,
  readJsonFromLocalStorage,
  writeJsonToLocalStorage,
} from "@/lib/local-storage";
import { PageTranslationSegmentItem } from "./page-translation-segment-item";
import { type TranslationSegmentAnalysisMode } from "./translation-segment-analysis";
import type { PageBlock, PageSegment } from "./types";
import { formatBlockLabel } from "./utils";

const TRANSLATION_SEGMENT_ANALYSIS_MODES = [
  {
    label: "Text",
    value: "text",
  },
  {
    label: "Reading",
    value: "reading",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  value: TranslationSegmentAnalysisMode;
}>;

type PageTranslationSegmentsCardProps = {
  pagePath: string;
  selectedBlock: PageBlock | null;
  translationSourceLanguages: readonly string[];
  previousBlock?: PageBlock | null;
  nextBlock?: PageBlock | null;
  onSelectBlock?: (blockId: string) => void;
};

function hasTranslation(segment: PageSegment): boolean {
  return Boolean(segment.translation?.trim());
}

function readStoredShowTranslationsByDefault() {
  const storedValue = readJsonFromLocalStorage<unknown>(
    LOCAL_STORAGE_KEYS.pageTranslationSegmentsShowTranslations,
  );

  return typeof storedValue === "boolean" ? storedValue : false;
}

function readStoredShowVocabulary() {
  const storedValue = readJsonFromLocalStorage<unknown>(
    LOCAL_STORAGE_KEYS.pageTranslationSegmentsShowVocabulary,
  );

  return typeof storedValue === "boolean" ? storedValue : false;
}

function isTranslationSegmentAnalysisMode(
  value: unknown,
): value is TranslationSegmentAnalysisMode {
  return TRANSLATION_SEGMENT_ANALYSIS_MODES.some(
    (mode) => mode.value === value,
  );
}

function readStoredAnalysisMode(): TranslationSegmentAnalysisMode {
  const storedValue = readJsonFromLocalStorage<unknown>(
    LOCAL_STORAGE_KEYS.pageTranslationSegmentsAnalysisMode,
  );

  return isTranslationSegmentAnalysisMode(storedValue) ? storedValue : "text";
}

export function PageTranslationSegmentsCard({
  pagePath,
  selectedBlock,
  translationSourceLanguages,
  previousBlock = null,
  nextBlock = null,
  onSelectBlock,
}: PageTranslationSegmentsCardProps) {
  const [analysisMode, setAnalysisMode] =
    useState<TranslationSegmentAnalysisMode>(readStoredAnalysisMode);
  const [showTranslationsByDefault, setShowTranslationsByDefault] = useState(
    readStoredShowTranslationsByDefault,
  );
  const [showVocabulary, setShowVocabulary] = useState(
    readStoredShowVocabulary,
  );
  const [
    translationVisibilityOverridesBySegmentId,
    setTranslationVisibilityOverridesBySegmentId,
  ] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const translationSourceLanguageSet = new Set(translationSourceLanguages);
  const segments = (selectedBlock?.segments ?? []).filter((segment) =>
    segment.languages.some((language) =>
      translationSourceLanguageSet.has(language),
    ),
  );
  const segmentsWithTranslation = segments.filter(hasTranslation);
  const hasVisibleTranslations = segmentsWithTranslation.length > 0;
  const isSegmentTranslationVisible = (segment: PageSegment) =>
    hasTranslation(segment) &&
    (translationVisibilityOverridesBySegmentId.get(segment.id) ??
      showTranslationsByDefault);
  const areAllTranslationsVisible =
    hasVisibleTranslations &&
    segmentsWithTranslation.every(isSegmentTranslationVisible);

  useEffect(() => {
    setTranslationVisibilityOverridesBySegmentId(new Map());
  }, [selectedBlock?.id]);

  const setSegmentTranslationVisible = (
    segmentId: string,
    visible: boolean,
  ) => {
    setTranslationVisibilityOverridesBySegmentId((currentOverrides) => {
      const nextOverrides = new Map(currentOverrides);

      if (visible === showTranslationsByDefault) {
        nextOverrides.delete(segmentId);
      } else {
        nextOverrides.set(segmentId, visible);
      }

      return nextOverrides;
    });
  };

  const toggleAllTranslations = () => {
    const nextShowTranslationsByDefault = !areAllTranslationsVisible;

    setShowTranslationsByDefault(nextShowTranslationsByDefault);
    writeJsonToLocalStorage(
      LOCAL_STORAGE_KEYS.pageTranslationSegmentsShowTranslations,
      nextShowTranslationsByDefault,
    );
    setTranslationVisibilityOverridesBySegmentId(new Map());
  };

  const toggleVocabulary = () => {
    const nextShowVocabulary = !showVocabulary;

    setShowVocabulary(nextShowVocabulary);
    writeJsonToLocalStorage(
      LOCAL_STORAGE_KEYS.pageTranslationSegmentsShowVocabulary,
      nextShowVocabulary,
    );
  };

  return (
    <Card className="min-h-64 gap-0 overflow-hidden py-0 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:self-start">
      <CardHeader className="shrink-0 border-b border-border py-3">
        <CardTitle>Translation segments</CardTitle>
        {selectedBlock ? (
          <CardAction className="row-span-1 row-start-1 flex min-w-0 items-center gap-2">
            <CardDescription className="truncate text-right">
              {formatBlockLabel(selectedBlock)}
            </CardDescription>
          </CardAction>
        ) : null}
        <div className="col-span-full row-start-2 flex min-w-0 flex-wrap items-center justify-between gap-3">
          {selectedBlock ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Translation segment analysis mode"
                className="inline-flex w-fit rounded-lg border border-border bg-background p-0.5"
              >
                {TRANSLATION_SEGMENT_ANALYSIS_MODES.map((mode) => (
                  <Button
                    key={mode.value}
                    type="button"
                    variant={
                      analysisMode === mode.value ? "secondary" : "ghost"
                    }
                    size="sm"
                    aria-pressed={analysisMode === mode.value}
                    className="h-6 px-2 text-xs shadow-none"
                    onClick={() => {
                      setAnalysisMode(mode.value);
                      writeJsonToLocalStorage(
                        LOCAL_STORAGE_KEYS.pageTranslationSegmentsAnalysisMode,
                        mode.value,
                      );
                    }}
                  >
                    {mode.label}
                  </Button>
                ))}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-pressed={showVocabulary}
                    aria-label={
                      showVocabulary ? "Hide vocabulary" : "Show vocabulary"
                    }
                    className="aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
                    onClick={toggleVocabulary}
                  >
                    <CaptionsIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {showVocabulary ? "Hide vocabulary" : "Show vocabulary"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={!hasVisibleTranslations}
                    aria-pressed={areAllTranslationsVisible}
                    aria-label={
                      areAllTranslationsVisible
                        ? "Collapse all translations"
                        : "Expand all translations"
                    }
                    className="aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
                    onClick={toggleAllTranslations}
                  >
                    <LanguagesIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {areAllTranslationsVisible
                    ? "Collapse all translations"
                    : "Expand all translations"}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <CardDescription>
              Select an OCR block from the preview.
            </CardDescription>
          )}
          {selectedBlock ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!previousBlock || !onSelectBlock}
                aria-label={
                  previousBlock
                    ? `Select previous OCR block: ${formatBlockLabel(previousBlock)}`
                    : "No previous OCR block"
                }
                onClick={() => {
                  if (!previousBlock) {
                    return;
                  }

                  onSelectBlock?.(previousBlock.id);
                }}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!nextBlock || !onSelectBlock}
                aria-label={
                  nextBlock
                    ? `Select next OCR block: ${formatBlockLabel(nextBlock)}`
                    : "No next OCR block"
                }
                onClick={() => {
                  if (!nextBlock) {
                    return;
                  }

                  onSelectBlock?.(nextBlock.id);
                }}
              >
                Next
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 overflow-y-auto py-4">
        {!selectedBlock ? (
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyTitle>No available blocks</EmptyTitle>
              <EmptyDescription>
                Text OCR blocks will appear after cleanup and splitting.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : segments.length === 0 ? (
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyTitle>No translatable segments</EmptyTitle>
              <EmptyDescription>
                This OCR block does not have translation segments in the
                configured source languages.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="flex flex-col gap-2 pr-1">
            {segments.map((segment, segmentIndex) => (
              <PageTranslationSegmentItem
                key={segment.id}
                analysisMode={analysisMode}
                blockId={selectedBlock.id}
                segment={segment}
                pagePath={pagePath}
                displayIndex={segmentIndex + 1}
                isTranslationVisible={isSegmentTranslationVisible(segment)}
                showVocabulary={showVocabulary}
                onTranslationVisibleChange={(visible) =>
                  setSegmentTranslationVisible(segment.id, visible)
                }
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
