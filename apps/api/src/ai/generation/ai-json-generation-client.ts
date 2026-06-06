import type { AiProcessingOperation } from "@/ai/config/ai-processing-config-schemas";

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
