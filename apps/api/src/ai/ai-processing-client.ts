import type {
  OcrBlockJson,
  VocabularyEntryJson,
} from "@/library/library-schemas";

export const AI_PROCESSING_CLIENT = Symbol("AI_PROCESSING_CLIENT");

export type AiCleanupContextBlock = {
  label: string | null;
  content: string;
};

export type AiCleanupInput = {
  pagePath: string;
  sourceLanguages: string[];
  targetLanguage: string;
  context: {
    previousPage: AiCleanupContextBlock[];
    nextPage: AiCleanupContextBlock[];
  };
  ocrBlocks: OcrBlockJson[];
};

export type AiCleanupResult = {
  blocks: OcrBlockJson[];
};

export type AiSplitInput = {
  pagePath: string;
  sourceLanguages: string[];
  targetLanguage: string;
  cleanupBlocks: OcrBlockJson[];
};

export type AiSplitSegment = {
  id: string;
  blockId: string;
  orderIndex: number;
  text: string;
  languages: string[];
};

export type AiSplitResult = {
  segments: AiSplitSegment[];
};

export type AiTranslationContext = {
  pagePath: string;
  sourceLanguages: string[];
  targetLanguage: string;
};

export type AiTranslationInputSegment = {
  id: string;
  text: string;
};

export type AiTranslateInput = {
  context: AiTranslationContext;
  segments: AiTranslationInputSegment[];
};

export type AiTranslatedSegment = {
  id: string;
  text: string;
  translation: string;
  textWithReading: string;
};

export type AiTranslateResult = {
  segments: AiTranslatedSegment[];
};

export type AiVocabularyInputSegment = {
  id: string;
  textWithReading: string;
};

export type AiVocabularyInput = {
  pagePath: string;
  sourceLanguages: string[];
  targetLanguage: string;
  segments: AiVocabularyInputSegment[];
};

export type AiSegmentVocabulary = {
  id: string;
  vocabulary: VocabularyEntryJson[];
};

export type AiVocabularyResult = {
  segments: AiSegmentVocabulary[];
};

export interface AiProcessingClient {
  cleanup(input: AiCleanupInput): Promise<AiCleanupResult>;
  split(input: AiSplitInput): Promise<AiSplitResult>;
  translate(input: AiTranslateInput): Promise<AiTranslateResult>;
  extractVocabulary(input: AiVocabularyInput): Promise<AiVocabularyResult>;
}
