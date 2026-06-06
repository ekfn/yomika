export const OCR_STATUS_VALUES = ["PENDING", "PROCESSING", "COMPLETE"] as const;

export type OcrStatus = (typeof OCR_STATUS_VALUES)[number];

export const AI_PROCESSING_STATUS_VALUES = [
  "CLEAN_UP_PENDING",
  "CLEAN_UP_PROCESSING",
  "SPLIT_PENDING",
  "SPLITTING",
  "TRANSLATION_PENDING",
  "TRANSLATING",
  "VOCABULARY_PENDING",
  "VOCABULARY_PROCESSING",
  "COMPLETE",
] as const;

export type AiProcessingStatus = (typeof AI_PROCESSING_STATUS_VALUES)[number];

export const BOOK_IMPORT_STATUS_VALUES = [
  "NONE",
  "PENDING",
  "IMPORTING",
  "COMPLETE",
] as const;

export type BookImportStatus = (typeof BOOK_IMPORT_STATUS_VALUES)[number];

export const RUNNER_STATE_VALUES = [
  "IDLE",
  "IDLE_WITH_SKIPPED_TASKS",
  "RUNNING",
  "STOPPED_AFTER_ERROR",
] as const;

export type RunnerState = (typeof RUNNER_STATE_VALUES)[number];
