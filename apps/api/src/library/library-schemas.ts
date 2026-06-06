import {
  AI_PROCESSING_STATUS_VALUES,
  BOOK_IMPORT_STATUS_VALUES,
  OCR_STATUS_VALUES,
} from "./library-status-values";
import { z } from "zod";

const isoDateStringSchema = z.string().datetime({ offset: true });

export const bookSettingsJsonSchema = z.object({
  translationSourceLanguages: z.array(z.string().min(1)).min(1),
  translationTargetLanguage: z.string().min(1),
  aiProcessingEnabled: z.boolean(),
  vocabularyEnabled: z.boolean(),
});

export const pageSettingsJsonSchema = bookSettingsJsonSchema.extend({
  translationSourceLanguages: z.array(z.string().min(1)).min(1).nullable(),
  translationTargetLanguage: z.string().min(1).nullable(),
  aiProcessingEnabled: z.boolean().nullable(),
  vocabularyEnabled: z.boolean().nullable(),
});

export const sourcePdfJsonSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().positive(),
});

export const sourceImageJsonSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  previewFileName: z.string().min(1).nullable(),
  previewWidthPx: z.number().int().positive().nullable(),
  previewHeightPx: z.number().int().positive().nullable(),
});

export const ocrBlockJsonSchema = z.object({
  id: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  label: z.string().nullable(),
  bboxX1: z.number().nullable(),
  bboxY1: z.number().nullable(),
  bboxX2: z.number().nullable(),
  bboxY2: z.number().nullable(),
  content: z.string(),
});

export const vocabularyEntryJsonSchema = z.object({
  text: z.string().min(1),
  translation: z.string().min(1),
});

export const pageSegmentJsonSchema = z.object({
  id: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  text: z.string(),
  languages: z.array(z.string().min(1)),
  translation: z.string().nullable(),
  textWithReading: z.string().nullable(),
  vocabulary: z.array(vocabularyEntryJsonSchema),
});

export const pageBlockJsonSchema = ocrBlockJsonSchema.extend({
  segments: z.array(pageSegmentJsonSchema),
});

export const bookJsonSchema = z.object({
  schemaVersion: z.literal(1),
  sourcePdf: sourcePdfJsonSchema.nullable(),
  settings: bookSettingsJsonSchema,
  importStatus: z.enum(BOOK_IMPORT_STATUS_VALUES),
  importedPageCount: z.number().int().nonnegative(),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});

export const pageJsonSchema = z.object({
  schemaVersion: z.literal(1),
  pageNumber: z.number().int().positive().nullable(),
  sourceImage: sourceImageJsonSchema,
  settings: pageSettingsJsonSchema,
  ocrStatus: z.enum(OCR_STATUS_VALUES),
  aiProcessingStatus: z.enum(AI_PROCESSING_STATUS_VALUES),
  ocrRawJson: z.unknown().nullable(),
  blocks: z.array(pageBlockJsonSchema),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});

export const runnerTaskJsonSchema = z.object({
  type: z.enum([
    "BOOK_IMPORT",
    "OCR",
    "CLEAN_UP",
    "SPLIT",
    "TRANSLATION",
    "VOCABULARY",
  ]),
  bookPath: z.string().min(1).nullable(),
  pagePath: z.string().min(1).nullable(),
  label: z.string().min(1),
});

export type BookJson = z.infer<typeof bookJsonSchema>;
export type PageJson = z.infer<typeof pageJsonSchema>;
export type OcrBlockJson = z.infer<typeof ocrBlockJsonSchema>;
export type PageBlockJson = z.infer<typeof pageBlockJsonSchema>;
export type PageSegmentJson = z.infer<typeof pageSegmentJsonSchema>;
export type VocabularyEntryJson = z.infer<typeof vocabularyEntryJsonSchema>;
