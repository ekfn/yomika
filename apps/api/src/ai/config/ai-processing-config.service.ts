import { BadRequestException, Injectable } from "@nestjs/common";
import { loadAppConfig } from "@/config/app-config";
import { JsonFileService } from "@/library/json-file.service";
import {
  AI_PROCESSING_OPERATION_VALUES,
  AI_THINKING_LEVEL_VALUES,
  aiProcessingConfigJsonSchema,
  type AiModelOptionJson,
  type AiProcessingConfigJson,
  type AiProcessingOperation,
  type AiProcessingStepModelConfigJson,
  type AiProcessingStepConfigJson,
  type AiThinkingLevel,
} from "./ai-processing-config-schemas";

export type AiGenerationModelConfig = {
  modelId: string;
  thinkingMode: AiModelOptionJson["thinkingMode"];
  thinkingLevel: AiThinkingLevel | null;
  requestsPerMinute: number;
};

const AI_PROCESSING_CONFIG_RELATIVE_PATH = "runtime/ai-processing-config.json";
const AI_PROCESSING_DEFAULT_CONFIG_RELATIVE_PATH =
  "ai-processing-default-config.json";

@Injectable()
export class AiProcessingConfigService {
  private readonly appConfig = loadAppConfig();

  constructor(private readonly jsonFiles: JsonFileService) {}

  async getConfig(): Promise<AiProcessingConfigJson> {
    try {
      return normalizeAiProcessingConfig(
        await this.jsonFiles.readJsonFile(
          this.appConfig.aiProcessingConfigPath,
          aiProcessingConfigJsonSchema,
          AI_PROCESSING_CONFIG_RELATIVE_PATH,
        ),
      );
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        throw error;
      }

      const defaultConfig = await this.readDefaultConfig();
      await this.writeConfig(defaultConfig);
      return defaultConfig;
    }
  }

  async updateConfig(input: unknown): Promise<AiProcessingConfigJson> {
    const parsed = aiProcessingConfigJsonSchema.safeParse(input);

    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid AI processing config: ${parsed.error.issues
          .map((issue) => {
            const path =
              issue.path.length > 0 ? issue.path.join(".") : "<root>";
            return `${path}: ${issue.message}`;
          })
          .join("; ")}`,
      );
    }

    const config = normalizeAiProcessingConfig(parsed.data);
    await this.writeConfig(config);
    return config;
  }

  async getGenerationModelConfigs(
    operation: AiProcessingOperation,
  ): Promise<AiGenerationModelConfig[]> {
    const config = await this.getConfig();
    const stepConfig = config.steps[operation];

    return stepConfig.models.map((modelConfig) => {
      const modelOption = config.modelOptions.find(
        (option) => option.id === modelConfig.modelId,
      );

      if (!modelOption) {
        throw new Error(
          `AI processing step ${operation} references unknown model ${modelConfig.modelId}.`,
        );
      }

      return {
        modelId: modelOption.id,
        thinkingMode: modelOption.thinkingMode,
        thinkingLevel: modelConfig.thinkingLevel,
        requestsPerMinute: modelOption.requestsPerMinute,
      };
    });
  }

  private async writeConfig(config: AiProcessingConfigJson): Promise<void> {
    await this.jsonFiles.writeJsonFileAtomically(
      this.appConfig.aiProcessingConfigPath,
      config,
    );
  }

  private async readDefaultConfig(): Promise<AiProcessingConfigJson> {
    return normalizeAiProcessingConfig(
      await this.jsonFiles.readJsonFile(
        this.appConfig.aiProcessingDefaultConfigPath,
        aiProcessingConfigJsonSchema,
        AI_PROCESSING_DEFAULT_CONFIG_RELATIVE_PATH,
      ),
    );
  }
}

function normalizeAiProcessingConfig(
  config: AiProcessingConfigJson,
): AiProcessingConfigJson {
  const modelOptions = config.modelOptions.map((option) => ({
    ...option,
    id: option.id.trim(),
  }));
  const modelOptionsById = new Map<string, AiModelOptionJson>();

  for (const option of modelOptions) {
    if (modelOptionsById.has(option.id)) {
      throw new BadRequestException(
        `Duplicate AI model option id ${option.id}.`,
      );
    }

    modelOptionsById.set(option.id, option);
  }

  return {
    modelOptions,
    steps: Object.fromEntries(
      AI_PROCESSING_OPERATION_VALUES.map((operation) => [
        operation,
        normalizeStepConfig(
          operation,
          config.steps[operation],
          modelOptionsById,
        ),
      ]),
    ) as AiProcessingConfigJson["steps"],
  };
}

function normalizeStepConfig(
  operation: AiProcessingOperation,
  stepConfig: AiProcessingStepConfigJson,
  modelOptionsById: Map<string, AiModelOptionJson>,
): AiProcessingStepConfigJson {
  const modelIds = new Set<string>();
  const models = stepConfig.models.map((modelConfig) => {
    const normalizedModelConfig = normalizeStepModelConfig(
      operation,
      modelConfig,
      modelOptionsById,
    );

    if (modelIds.has(normalizedModelConfig.modelId)) {
      throw new BadRequestException(
        `AI processing step ${operation} includes duplicate model ${normalizedModelConfig.modelId}.`,
      );
    }

    modelIds.add(normalizedModelConfig.modelId);
    return normalizedModelConfig;
  });

  return { models };
}

function normalizeStepModelConfig(
  operation: AiProcessingOperation,
  modelConfig: AiProcessingStepModelConfigJson,
  modelOptionsById: Map<string, AiModelOptionJson>,
): AiProcessingStepModelConfigJson {
  const modelId = modelConfig.modelId.trim();
  const modelOption = modelOptionsById.get(modelId);

  if (!modelOption) {
    throw new BadRequestException(
      `AI processing step ${operation} references unknown model ${modelId}.`,
    );
  }

  if (modelOption.thinkingMode !== "LEVEL") {
    return {
      modelId,
      thinkingLevel: null,
    };
  }

  if (!modelConfig.thinkingLevel) {
    throw new BadRequestException(
      `AI processing step ${operation} must select a thinking level for model ${modelOption.id}.`,
    );
  }

  if (!AI_THINKING_LEVEL_VALUES.includes(modelConfig.thinkingLevel)) {
    throw new BadRequestException(
      `AI processing step ${operation} uses unsupported thinking level ${modelConfig.thinkingLevel}.`,
    );
  }

  return {
    modelId,
    thinkingLevel: modelConfig.thinkingLevel,
  };
}

function isFileNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = error.cause;

  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}
