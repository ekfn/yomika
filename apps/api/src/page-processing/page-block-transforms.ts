import {
  type AiSegmentVocabulary,
  type AiSplitSegment,
  type AiTranslatedSegment,
  type AiTranslationInputSegment,
  type AiVocabularyInputSegment,
} from "@/ai/ai-processing-client";
import type { OcrBlockJson, PageBlockJson } from "@/library/library-schemas";
import { isTextOcrBlockLabel } from "@/ocr/ocr-block-labels";

export function toPageBlockWithoutSegments(block: OcrBlockJson): PageBlockJson {
  return {
    ...block,
    segments: [],
  };
}

export function isEditableCleanupOcrBlock(block: OcrBlockJson): boolean {
  return isTextOcrBlockLabel(block.label) && block.content.trim().length > 0;
}

export function normalizeCleanupOcrBlockContent(content: string): string {
  return content.replaceAll("（", "(").replaceAll("）", ")");
}

export function applySplitSegmentsToBlocks(
  blocks: PageBlockJson[],
  segments: AiSplitSegment[],
): PageBlockJson[] {
  const segmentsByBlockId = new Map<string, AiSplitSegment[]>();

  for (const segment of segments) {
    const blockSegments = segmentsByBlockId.get(segment.blockId) ?? [];

    blockSegments.push(segment);
    segmentsByBlockId.set(segment.blockId, blockSegments);
  }

  return blocks.map((block) => ({
    ...block,
    segments: (segmentsByBlockId.get(block.id) ?? [])
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((segment) => ({
        id: segment.id,
        orderIndex: segment.orderIndex,
        text: segment.text,
        languages: segment.languages,
        translation: null,
        textWithReading: null,
        vocabulary: [],
      })),
  }));
}

export function toAiTranslationInputSegments(
  blocks: PageBlockJson[],
  sourceLanguages: string[],
): AiTranslationInputSegment[] {
  const sourceLanguageSet = new Set(sourceLanguages);

  return blocks.flatMap((block) =>
    block.segments
      .filter(
        (segment) =>
          segment.languages.length > 0 &&
          segment.languages.some((language) => sourceLanguageSet.has(language)),
      )
      .map((segment) => ({
        id: segment.id,
        text: segment.text,
      })),
  );
}

export function applyTranslationsToBlocks(
  blocks: PageBlockJson[],
  translations: AiTranslatedSegment[],
): PageBlockJson[] {
  const translationById = new Map(
    translations.map((translation) => [translation.id, translation]),
  );

  return blocks.map((block) => ({
    ...block,
    segments: block.segments.map((segment) => {
      const translation = translationById.get(segment.id);

      if (!translation) {
        return segment;
      }

      return {
        ...segment,
        translation: translation.translation,
        textWithReading: translation.textWithReading,
      };
    }),
  }));
}

export function toAiVocabularyInputSegments(
  blocks: PageBlockJson[],
  sourceLanguages: string[],
): AiVocabularyInputSegment[] {
  const sourceLanguageSet = new Set(sourceLanguages);

  return blocks.flatMap((block) =>
    block.segments
      .filter(
        (segment) =>
          segment.languages.length > 0 &&
          segment.languages.some((language) => sourceLanguageSet.has(language)),
      )
      .flatMap((segment) => {
        if (!segment.textWithReading?.trim()) {
          return [];
        }

        return [
          {
            id: segment.id,
            textWithReading: segment.textWithReading,
          },
        ];
      }),
  );
}

export function applyVocabularyToBlocks(
  blocks: PageBlockJson[],
  vocabularyBySegment: AiSegmentVocabulary[],
): PageBlockJson[] {
  const vocabularyBySegmentId = new Map(
    vocabularyBySegment.map((segmentVocabulary) => [
      segmentVocabulary.id,
      segmentVocabulary.vocabulary,
    ]),
  );

  return blocks.map((block) => ({
    ...block,
    segments: block.segments.map((segment) => ({
      ...segment,
      vocabulary: vocabularyBySegmentId.get(segment.id) ?? segment.vocabulary,
    })),
  }));
}
