import { useEffect, useRef, useState } from "react";
import { CaptionsIcon, LanguagesIcon, PencilIcon } from "lucide-react";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  getTranslationSegmentAnalysisItems,
  getTranslationSegmentRenderParts,
  type TranslationSegmentAnalysisMode,
} from "./translation-segment-analysis";
import { TranslationSegmentAnalysisMark } from "./translation-segment-analysis-mark";
import { getTranslationSegmentAnalysisColorStyle } from "./translation-segment-colors";
import {
  getSourceTextFromTextWithReading,
  TextWithReading,
} from "./text-with-reading";
import {
  hasSegmentTextWithReadingMismatch,
  TextWithReadingEditForm,
} from "./text-with-reading-editor";
import type { PageSegment } from "./types";
import { cn } from "@/lib/utils";

type PageTranslationSegmentItemProps = {
  analysisMode: TranslationSegmentAnalysisMode;
  blockId: string;
  displayIndex: number;
  isTranslationVisible: boolean;
  pagePath: string;
  segment: PageSegment;
  showVocabulary: boolean;
  onTranslationVisibleChange: (visible: boolean) => void;
};

type TranslationSegmentTranslationDetailsProps = {
  translation: string;
};

function TranslationSegmentTranslationDetails({
  translation,
}: TranslationSegmentTranslationDetailsProps) {
  return (
    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
      {translation}
    </p>
  );
}

function TranslationSegmentVocabularyDetails({
  segment,
}: {
  segment: PageSegment;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-5">
      <ul className="flex flex-col gap-1">
        {segment.vocabulary.map((entry, entryIndex) => {
          const sourceText =
            getSourceTextFromTextWithReading(entry.text) ?? entry.text;

          return (
            <li
              key={`${entry.text}-${entry.translation}-${entryIndex}`}
              className="whitespace-pre-wrap break-words"
            >
              <TextWithReading
                sourceText={sourceText}
                text={sourceText}
                textRange={{
                  endIndex: sourceText.length,
                  startIndex: 0,
                }}
                textWithReading={entry.text}
                className="text-lg leading-7 text-foreground"
              />
              <span className="text-muted-foreground"> — </span>
              <span className="text-muted-foreground">{entry.translation}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PageTranslationSegmentItem({
  analysisMode,
  blockId,
  displayIndex,
  isTranslationVisible,
  pagePath,
  segment,
  showVocabulary,
  onTranslationVisibleChange,
}: PageTranslationSegmentItemProps) {
  const [openAnalysisItemKey, setOpenAnalysisItemKey] = useState<string | null>(
    null,
  );
  const [isVocabularyOpen, setIsVocabularyOpen] = useState(false);
  const lastPointerTypeRef = useRef<string | null>(null);
  const translation = segment.translation?.trim();
  const hasVocabulary = segment.vocabulary.length > 0;
  const vocabularyColorStyle = getTranslationSegmentAnalysisColorStyle(
    segment.id,
    "vocabulary",
    0,
  );
  const vocabularyCountLabel = `${segment.vocabulary.length} ${
    segment.vocabulary.length === 1 ? "entry" : "entries"
  }`;
  const analysisItems = getTranslationSegmentAnalysisItems(
    segment,
    analysisMode,
  );
  const textParts = getTranslationSegmentRenderParts(
    segment.sourceText,
    analysisItems,
  );
  const canEditReadingMismatch =
    analysisMode === "reading" && hasSegmentTextWithReadingMismatch(segment);

  useEffect(() => {
    setOpenAnalysisItemKey(null);
  }, [analysisMode, segment.id]);

  useEffect(() => {
    setIsVocabularyOpen(false);
  }, [segment.id]);

  useEffect(() => {
    if (!showVocabulary) {
      setIsVocabularyOpen(false);
    }
  }, [showVocabulary]);

  return (
    <Popover open={isVocabularyOpen} onOpenChange={setIsVocabularyOpen}>
      <PopoverAnchor asChild>
        <li
          style={hasVocabulary ? vocabularyColorStyle : undefined}
          className="relative flex min-w-0 gap-0 rounded-md border border-border bg-background px-3 py-2"
        >
          {showVocabulary && hasVocabulary ? (
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Show vocabulary for segment ${displayIndex} (${vocabularyCountLabel})`}
                aria-pressed={isVocabularyOpen}
                className="group/vocabulary-gutter relative -my-2 -ml-3 flex w-10 shrink-0 cursor-pointer items-start overflow-hidden rounded-l-md py-2 pr-1 pl-3 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-pressed:text-foreground"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-l-md bg-(--translation-segment-color) transition-[width] motion-reduce:transition-none group-focus-visible/vocabulary-gutter:w-1",
                    isVocabularyOpen && "w-0.75",
                  )}
                />
                <CaptionsIcon className="mt-1 ml-1 size-3.5 shrink-0" />
              </button>
            </PopoverTrigger>
          ) : showVocabulary ? (
            <span className="-my-2 -ml-3 flex w-10 shrink-0 items-start rounded-l-md py-2 pr-1 pl-3 text-muted-foreground/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    aria-label={`No vocabulary available for segment ${displayIndex}`}
                    className="mt-1 ml-1 flex size-3.5 shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <CaptionsIcon className="size-3.5" aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent align="center" side="left" sideOffset={8}>
                  No vocabulary available
                </TooltipContent>
              </Tooltip>
            </span>
          ) : (
            <div className="-my-2 -ml-3 flex w-10 shrink-0 items-start rounded-l-md py-2 pr-1 pl-3">
              <Badge variant="outline" className="mt-0.5 select-none">
                {displayIndex}
              </Badge>
            </div>
          )}
          <Collapsible
            open={isTranslationVisible}
            onOpenChange={onTranslationVisibleChange}
            className="min-w-0 flex-1 pl-2"
          >
            <div className="flex min-w-0 items-start gap-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-base leading-6 text-foreground">
                {textParts.map((part) => {
                  if (part.type === "text") {
                    return <span key={part.key}>{part.text}</span>;
                  }

                  const analysisItemKey = `${part.analysisItem.kind}-${part.analysisItem.index}`;
                  const isSelected = openAnalysisItemKey === analysisItemKey;
                  const colorStyle = getTranslationSegmentAnalysisColorStyle(
                    segment.id,
                    part.analysisItem.kind,
                    part.analysisItem.index,
                  );

                  return (
                    <Tooltip
                      key={part.key}
                      open={isSelected}
                      onOpenChange={(open) => {
                        if (open) {
                          if (lastPointerTypeRef.current !== "touch") {
                            setOpenAnalysisItemKey(analysisItemKey);
                          }

                          return;
                        }

                        setOpenAnalysisItemKey((currentKey) =>
                          currentKey === analysisItemKey ? null : currentKey,
                        );
                      }}
                    >
                      <TooltipTrigger asChild>
                        <TranslationSegmentAnalysisMark
                          colorStyle={colorStyle}
                          isSelected={isSelected}
                          className="relative after:absolute after:-top-0.5 after:-right-1 after:-bottom-0.5 after:-left-1 after:content-['']"
                          onBlur={() => {
                            setOpenAnalysisItemKey((currentKey) =>
                              currentKey === analysisItemKey
                                ? null
                                : currentKey,
                            );
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setOpenAnalysisItemKey(null);
                            }
                          }}
                          onPointerDownCapture={(event) => {
                            lastPointerTypeRef.current = event.pointerType;
                          }}
                          onPointerMoveCapture={(event) => {
                            lastPointerTypeRef.current = event.pointerType;
                          }}
                          onToggle={() =>
                            setOpenAnalysisItemKey((currentKey) =>
                              currentKey === analysisItemKey
                                ? null
                                : analysisItemKey,
                            )
                          }
                        >
                          {part.text}
                        </TranslationSegmentAnalysisMark>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={4}
                        disableAnimation
                        showArrow={false}
                        className="pointer-events-none border border-border bg-background px-2 py-1 text-muted-foreground shadow-sm"
                      >
                        {part.analysisItem.reading}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </p>
              {canEditReadingMismatch || translation ? (
                <div className="mt-0.5 flex shrink-0 items-center gap-1">
                  {canEditReadingMismatch ? (
                    <ReadingMismatchEditorPopover
                      blockId={blockId}
                      pagePath={pagePath}
                      segment={segment}
                    />
                  ) : null}
                  {translation ? (
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={
                          isTranslationVisible
                            ? "Hide translation"
                            : "Show translation"
                        }
                        className="text-muted-foreground"
                      >
                        <LanguagesIcon />
                      </Button>
                    </CollapsibleTrigger>
                  ) : null}
                </div>
              ) : null}
            </div>
            {translation ? (
              <CollapsibleContent>
                <TranslationSegmentTranslationDetails
                  translation={translation}
                />
              </CollapsibleContent>
            ) : null}
          </Collapsible>
        </li>
      </PopoverAnchor>
      {showVocabulary && hasVocabulary ? (
        <PopoverContent
          align="start"
          side="left"
          sideOffset={10}
          style={vocabularyColorStyle}
          className="max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-2rem)] overflow-y-auto border-r-2 border-r-(--translation-segment-color)"
        >
          <TranslationSegmentVocabularyDetails segment={segment} />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

function ReadingMismatchEditorPopover({
  blockId,
  pagePath,
  segment,
}: {
  blockId: string;
  pagePath: string;
  segment: PageSegment;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="warning-ghost"
              size="icon-xs"
              aria-label="Edit mismatched reading"
            >
              <PencilIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          Edit mismatched reading
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[28rem] max-w-[calc(100vw-2rem)] p-3"
      >
        <PopoverHeader>
          <PopoverTitle>Mismatched reading</PopoverTitle>
          <PopoverDescription>
            Edit text with reading for this segment.
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-2">
          <p className="whitespace-pre-wrap break-words rounded bg-muted px-2 py-1.5 text-sm leading-relaxed text-foreground">
            {segment.sourceText}
          </p>
          <TextWithReadingEditForm
            blockId={blockId}
            pagePath={pagePath}
            segment={segment}
            showCancel={false}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
