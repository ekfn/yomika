import { z } from "zod";

export const AI_PROCESSING_OPERATION_VALUES = [
  "cleanup",
  "split",
  "translation",
  "vocabulary",
] as const;

export type AiProcessingOperation =
  (typeof AI_PROCESSING_OPERATION_VALUES)[number];

export const AI_THINKING_MODE_VALUES = ["BUDGET", "LEVEL"] as const;

export type AiThinkingMode = (typeof AI_THINKING_MODE_VALUES)[number];

export const AI_THINKING_LEVEL_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

export type AiThinkingLevel = (typeof AI_THINKING_LEVEL_VALUES)[number];

const aiModelOptionJsonSchema = z.object({
  id: z.string().trim().min(1),
  thinkingMode: z.enum(AI_THINKING_MODE_VALUES),
  requestsPerMinute: z.number().int().min(1),
});

const aiProcessingStepModelConfigJsonSchema = z.object({
  modelId: z.string().trim().min(1),
  thinkingLevel: z.enum(AI_THINKING_LEVEL_VALUES).nullable().default(null),
});

const aiProcessingStepConfigJsonSchema = z.object({
  models: z.array(aiProcessingStepModelConfigJsonSchema).min(1),
});

export const aiProcessingConfigJsonSchema = z.object({
  modelOptions: z.array(aiModelOptionJsonSchema).min(1),
  steps: z.object({
    cleanup: aiProcessingStepConfigJsonSchema,
    split: aiProcessingStepConfigJsonSchema,
    translation: aiProcessingStepConfigJsonSchema,
    vocabulary: aiProcessingStepConfigJsonSchema,
  }),
});

export type AiModelOptionJson = z.infer<typeof aiModelOptionJsonSchema>;
export type AiProcessingStepModelConfigJson = z.infer<
  typeof aiProcessingStepModelConfigJsonSchema
>;
export type AiProcessingStepConfigJson = z.infer<
  typeof aiProcessingStepConfigJsonSchema
>;
export type AiProcessingConfigJson = z.infer<
  typeof aiProcessingConfigJsonSchema
>;
