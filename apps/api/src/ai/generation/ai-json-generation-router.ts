import { Injectable } from "@nestjs/common";
import { AiProcessingConfigService } from "@/ai/config/ai-processing-config.service";
import type {
  AiJsonGenerationClient,
  AiJsonGenerationInput,
  AiProviderJsonGenerationClient,
} from "./ai-json-generation-client";
import { AiModelRunStateService } from "./ai-model-run-state.service";
import { AiOperationModelsExhaustedError } from "./ai-operation-models-exhausted.error";
import { AiRequestLogContextService } from "./ai-request-log-context.service";
import { GeminiJsonGenerationClient } from "./gemini-json-generation-client";
import { GithubModelsJsonGenerationClient } from "./github-models-json-generation-client";
import { isAiProviderRateLimitError } from "./ai-provider-rate-limit.error";

@Injectable()
export class AiJsonGenerationRouter implements AiJsonGenerationClient {
  constructor(
    private readonly aiProcessingConfigService: AiProcessingConfigService,
    private readonly aiModelRunState: AiModelRunStateService,
    private readonly aiRequestLogContext: AiRequestLogContextService,
    private readonly geminiClient: GeminiJsonGenerationClient,
    private readonly githubModelsClient: GithubModelsJsonGenerationClient,
  ) {}

  async generateJson(input: AiJsonGenerationInput): Promise<unknown> {
    const modelConfigs =
      await this.aiProcessingConfigService.getGenerationModelConfigs(
        input.operation,
      );

    for (const modelConfig of modelConfigs) {
      if (this.aiModelRunState.isModelExhausted(modelConfig.modelRunKey)) {
        continue;
      }

      await this.aiModelRunState.waitForRequestSlot(
        modelConfig.modelRunKey,
        modelConfig.requestsPerMinute,
      );

      try {
        await this.aiRequestLogContext.recordAiRequest(modelConfig.modelRunKey);
        return await this.getProviderClient(modelConfig.provider).generateJson(
          input,
          modelConfig,
        );
      } catch (error) {
        if (!isAiProviderRateLimitError(error)) {
          throw error;
        }

        this.aiModelRunState.markModelExhausted(modelConfig.modelRunKey);
      }
    }

    throw new AiOperationModelsExhaustedError({
      operation: input.operation,
      operationName: input.operationName,
      modelIds: modelConfigs.map((modelConfig) => modelConfig.modelRunKey),
    });
  }

  private getProviderClient(provider: string): AiProviderJsonGenerationClient {
    switch (provider) {
      case "gemini":
        return this.geminiClient;
      case "github-models":
        return this.githubModelsClient;
      default:
        throw new Error(`Unsupported AI model provider ${provider}.`);
    }
  }
}
