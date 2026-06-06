import {
  getSegmentTextWithReading,
  getTextWithReadingAnnotations,
} from "./text-with-reading";
import type { PageSegment } from "./types";

export type TranslationSegmentAnalysisMode = "text" | "reading";

export type TranslationSegmentAnalysisItem = {
  endIndex: number;
  index: number;
  kind: "reading";
  reading: string;
  startIndex: number;
  text: string;
};

export type TranslationSegmentRenderPart =
  | {
      endIndex: number;
      key: string;
      startIndex: number;
      text: string;
      type: "text";
    }
  | {
      analysisItem: TranslationSegmentAnalysisItem;
      endIndex: number;
      key: string;
      startIndex: number;
      text: string;
      type: "analysisItem";
    };

export function getTranslationSegmentAnalysisItems(
  segment: PageSegment,
  analysisMode: TranslationSegmentAnalysisMode,
): TranslationSegmentAnalysisItem[] {
  if (analysisMode === "text") {
    return [];
  }

  if (analysisMode === "reading") {
    return getTextWithReadingAnnotations(
      segment.sourceText,
      getSegmentTextWithReading(segment),
    ).map((annotation, index) => ({
      ...annotation,
      index,
      kind: "reading" as const,
    }));
  }

  return [];
}

export function getTranslationSegmentRenderParts(
  text: string,
  analysisItems: readonly TranslationSegmentAnalysisItem[],
): TranslationSegmentRenderPart[] {
  const parts: TranslationSegmentRenderPart[] = [];
  let cursor = 0;

  analysisItems.forEach((analysisItem) => {
    if (analysisItem.startIndex < cursor) {
      return;
    }

    if (analysisItem.startIndex > cursor) {
      parts.push({
        endIndex: analysisItem.startIndex,
        key: `text-${cursor}-${analysisItem.startIndex}`,
        startIndex: cursor,
        text: text.slice(cursor, analysisItem.startIndex),
        type: "text",
      });
    }

    parts.push({
      analysisItem,
      endIndex: analysisItem.endIndex,
      key: `${analysisItem.kind}-${analysisItem.index}-${analysisItem.startIndex}`,
      startIndex: analysisItem.startIndex,
      text: text.slice(analysisItem.startIndex, analysisItem.endIndex),
      type: "analysisItem",
    });

    cursor = analysisItem.endIndex;
  });

  if (cursor < text.length) {
    parts.push({
      endIndex: text.length,
      key: `text-${cursor}-${text.length}`,
      startIndex: cursor,
      text: text.slice(cursor),
      type: "text",
    });
  }

  return parts.length > 0
    ? parts
    : [
        {
          endIndex: text.length,
          key: "text-0",
          startIndex: 0,
          text,
          type: "text",
        },
      ];
}
