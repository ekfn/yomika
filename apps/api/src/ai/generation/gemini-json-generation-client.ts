import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import {
  AiProcessingConfigService,
  type AiGenerationModelConfig,
} from "@/ai/config/ai-processing-config.service";
import { loadAppConfig } from "@/config/app-config";
import { AiModelRunStateService } from "./ai-model-run-state.service";
import { AiOperationModelsExhaustedError } from "./ai-operation-models-exhausted.error";
import { AiRequestLogContextService } from "./ai-request-log-context.service";
import type {
  AiJsonGenerationClient,
  AiJsonGenerationInput,
} from "./ai-json-generation-client";
import { buildGeminiGenerateContentConfig } from "./gemini-model.constants";

@Injectable()
export class GeminiJsonGenerationClient implements AiJsonGenerationClient {
  private readonly config = loadAppConfig();
  private readonly ai = new GoogleGenAI({ apiKey: this.config.geminiApiKey });

  constructor(
    private readonly aiProcessingConfigService: AiProcessingConfigService,
    private readonly aiModelRunState: AiModelRunStateService,
    private readonly aiRequestLogContext: AiRequestLogContextService,
  ) {}

  async generateJson(input: AiJsonGenerationInput): Promise<unknown> {
    const modelConfigs =
      await this.aiProcessingConfigService.getGenerationModelConfigs(
        input.operation,
      );

    for (const modelConfig of modelConfigs) {
      if (this.aiModelRunState.isModelExhausted(modelConfig.modelId)) {
        continue;
      }

      await this.aiModelRunState.waitForRequestSlot(
        modelConfig.modelId,
        modelConfig.requestsPerMinute,
      );

      try {
        return await this.generateJsonWithModel(input, modelConfig);
      } catch (error) {
        if (!isGeminiRateLimitError(error)) {
          throw error;
        }

        this.aiModelRunState.markModelExhausted(modelConfig.modelId);
      }
    }

    throw new AiOperationModelsExhaustedError({
      operation: input.operation,
      operationName: input.operationName,
      modelIds: modelConfigs.map((modelConfig) => modelConfig.modelId),
    });
  }

  private async generateJsonWithModel(
    input: AiJsonGenerationInput,
    modelConfig: AiGenerationModelConfig,
  ): Promise<unknown> {
    await this.aiRequestLogContext.recordAiRequest(modelConfig.modelId);

    const response = await this.ai.models.generateContent({
      model: modelConfig.modelId,
      contents: input.prompt,
      config: buildGeminiGenerateContentConfig(modelConfig, {
        responseMimeType: "application/json",
        responseJsonSchema: input.responseJsonSchema,
      }),
    });
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
