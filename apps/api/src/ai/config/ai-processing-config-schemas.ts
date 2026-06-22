import { z } from "zod";

export const AI_PROCESSING_OPERATION_VALUES = [
  "cleanup",
  "split",
  "translation",
  "vocabulary",
] as const;

export type AiProcessingOperation =
  (typeof AI_PROCESSING_OPERATION_VALUES)[number];

export const AI_MODEL_PROVIDER_VALUES = ["gemini", "github-models"] as const;

export type AiModelProvider = (typeof AI_MODEL_PROVIDER_VALUES)[number];

const aiModelProfileJsonSchema = z.object({
  name: z.string().trim().min(1),
  parametersJson: z.string().default(""),
});

const aiModelJsonSchema = z.object({
  provider: z.enum(AI_MODEL_PROVIDER_VALUES),
  modelId: z.string().trim().min(1),
  requestsPerMinute: z.number().int().min(1),
  profiles: z.array(aiModelProfileJsonSchema).min(1),
});

const aiProcessingStepModelConfigJsonSchema = z.object({
  provider: z.enum(AI_MODEL_PROVIDER_VALUES),
  modelId: z.string().trim().min(1),
  profileName: z.string().trim().min(1),
});

const aiProcessingStepConfigJsonSchema = z.object({
  models: z.array(aiProcessingStepModelConfigJsonSchema).min(1),
});

export const aiProcessingConfigJsonSchema = z.object({
  models: z.array(aiModelJsonSchema).min(1),
  steps: z.object({
    cleanup: aiProcessingStepConfigJsonSchema,
    split: aiProcessingStepConfigJsonSchema,
    translation: aiProcessingStepConfigJsonSchema,
    vocabulary: aiProcessingStepConfigJsonSchema,
  }),
});

export type AiModelJson = z.infer<typeof aiModelJsonSchema>;
export type AiModelProfileJson = z.infer<typeof aiModelProfileJsonSchema>;
export type AiProcessingStepModelConfigJson = z.infer<
  typeof aiProcessingStepModelConfigJsonSchema
>;
export type AiProcessingStepConfigJson = z.infer<
  typeof aiProcessingStepConfigJsonSchema
>;
export type AiProcessingConfigJson = z.infer<
  typeof aiProcessingConfigJsonSchema
>;
