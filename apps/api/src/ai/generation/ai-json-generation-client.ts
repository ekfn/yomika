import type { AiProcessingOperation } from "@/ai/config/ai-processing-config-schemas";
import type { AiGenerationModelConfig } from "@/ai/config/ai-processing-config.service";

export const AI_JSON_GENERATION_CLIENT = Symbol("AI_JSON_GENERATION_CLIENT");

export type AiJsonGenerationInput = {
  operation: AiProcessingOperation;
  operationName: string;
  prompt: string;
  responseJsonSchema: unknown;
};

export interface AiJsonGenerationClient {
  generateJson(input: AiJsonGenerationInput): Promise<unknown>;
}

export interface AiProviderJsonGenerationClient {
  generateJson(
    input: AiJsonGenerationInput,
    modelConfig: AiGenerationModelConfig,
  ): Promise<unknown>;
}
