import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentConfig } from "@google/genai";
import type { AiGenerationModelConfig } from "@/ai/config/ai-processing-config.service";
import { loadAppConfig } from "@/config/app-config";
import { AiProviderRateLimitError } from "./ai-provider-rate-limit.error";
import type {
  AiJsonGenerationInput,
  AiProviderJsonGenerationClient,
} from "./ai-json-generation-client";

@Injectable()
export class GeminiJsonGenerationClient implements AiProviderJsonGenerationClient {
  private readonly config = loadAppConfig();

  async generateJson(
    input: AiJsonGenerationInput,
    modelConfig: AiGenerationModelConfig,
  ): Promise<unknown> {
    if (!this.config.geminiApiKey) {
      throw new Error(`Gemini ${input.operationName} requires GEMINI_API_KEY.`);
    }

    const ai = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
    let response;

    try {
      response = await ai.models.generateContent({
        model: modelConfig.modelId,
        contents: input.prompt,
        config: {
          ...(modelConfig.parameters as Partial<GenerateContentConfig>),
          responseMimeType: "application/json",
          responseJsonSchema: input.responseJsonSchema,
        },
      });
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        throw new AiProviderRateLimitError(
          `Gemini ${input.operationName} was rate limited for ${modelConfig.modelId}.`,
        );
      }

      throw error;
    }

    const text = response.text;

    if (!text) {
      throw new Error(
        `Gemini ${input.operationName} returned an empty response.`,
      );
    }

    return JSON.parse(text) as unknown;
  }
}

function isGeminiRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 429
  );
}
