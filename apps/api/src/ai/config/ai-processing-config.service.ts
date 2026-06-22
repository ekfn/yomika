import { BadRequestException, Injectable } from "@nestjs/common";
import { loadAppConfig } from "@/config/app-config";
import { JsonFileService } from "@/library/json-file.service";
import {
  AI_PROCESSING_OPERATION_VALUES,
  aiProcessingConfigJsonSchema,
  type AiModelJson,
  type AiModelProvider,
  type AiModelProfileJson,
  type AiProcessingConfigJson,
  type AiProcessingOperation,
  type AiProcessingStepConfigJson,
  type AiProcessingStepModelConfigJson,
} from "./ai-processing-config-schemas";

export type AiGenerationModelConfig = {
  provider: AiModelProvider;
  modelId: string;
  modelRunKey: string;
  parameters: AiGenerationModelParameters;
  requestsPerMinute: number;
};

export type AiGenerationModelParameters = Record<string, unknown>;

const AI_PROCESSING_CONFIG_RELATIVE_PATH = "runtime/ai-processing-config.json";
const AI_PROCESSING_DEFAULT_CONFIG_RELATIVE_PATH =
  "ai-processing-default-config.json";
const AI_MODEL_KEY_SEPARATOR = "__";

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
    const modelsByKey = getModelsByKey(config.models);

    return stepConfig.models.map((stepModelConfig) => {
      const modelRunKey = getAiModelKey(
        stepModelConfig.provider,
        stepModelConfig.modelId,
      );
      const model = modelsByKey.get(modelRunKey);

      if (!model) {
        throw new Error(
          `AI processing step ${operation} references unknown model ${modelRunKey}.`,
        );
      }

      const profile = getModelProfile(model, stepModelConfig.profileName);

      if (!profile) {
        throw new Error(
          `AI processing step ${operation} references unknown model profile ${modelRunKey}/${stepModelConfig.profileName}.`,
        );
      }

      return {
        provider: model.provider,
        modelId: model.modelId,
        modelRunKey,
        parameters: parseModelParametersJson({
          label: `AI model profile ${modelRunKey}/${profile.name}`,
          parametersJson: profile.parametersJson,
        }),
        requestsPerMinute: model.requestsPerMinute,
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
  const models = config.models.map(normalizeModel);
  const modelsByKey = getModelsByKey(models);

  return {
    models,
    steps: Object.fromEntries(
      AI_PROCESSING_OPERATION_VALUES.map((operation) => [
        operation,
        normalizeStepConfig(operation, config.steps[operation], modelsByKey),
      ]),
    ) as AiProcessingConfigJson["steps"],
  };
}

function getModelsByKey(models: AiModelJson[]): Map<string, AiModelJson> {
  const modelsByKey = new Map<string, AiModelJson>();

  for (const model of models) {
    const modelKey = getAiModelKey(model.provider, model.modelId);

    if (modelsByKey.has(modelKey)) {
      throw new BadRequestException(`Duplicate AI model ${modelKey}.`);
    }

    modelsByKey.set(modelKey, model);
  }

  return modelsByKey;
}

function normalizeModel(model: AiModelJson): AiModelJson {
  const modelId = model.modelId.trim();
  const modelWithoutProfiles = {
    ...model,
    modelId,
  };
  const normalizedModel = {
    ...modelWithoutProfiles,
    profiles: model.profiles.map((profile) =>
      normalizeModelProfile(modelWithoutProfiles, profile),
    ),
  };
  const profileNames = new Set<string>();
  const modelKey = getAiModelKey(
    normalizedModel.provider,
    normalizedModel.modelId,
  );

  for (const profile of normalizedModel.profiles) {
    if (profileNames.has(profile.name)) {
      throw new BadRequestException(
        `AI model ${modelKey} includes duplicate profile ${profile.name}.`,
      );
    }

    profileNames.add(profile.name);
  }

  return normalizedModel;
}

function normalizeModelProfile(
  model: AiModelJson,
  profile: AiModelProfileJson,
): AiModelProfileJson {
  const normalizedProfile = {
    ...profile,
    name: profile.name.trim(),
    parametersJson: profile.parametersJson.trim(),
  };

  parseModelParametersJson({
    label: `AI model profile ${getAiModelKey(model.provider, model.modelId)}/${normalizedProfile.name}`,
    parametersJson: normalizedProfile.parametersJson,
  });

  return normalizedProfile;
}

function normalizeStepConfig(
  operation: AiProcessingOperation,
  stepConfig: AiProcessingStepConfigJson,
  modelsByKey: Map<string, AiModelJson>,
): AiProcessingStepConfigJson {
  const profileKeys = new Set<string>();
  const models = stepConfig.models.map((modelConfig) => {
    const normalizedModelConfig = normalizeStepModelConfig(
      operation,
      modelConfig,
      modelsByKey,
    );
    const profileKey = getAiProfileKey(normalizedModelConfig);

    if (profileKeys.has(profileKey)) {
      throw new BadRequestException(
        `AI processing step ${operation} includes duplicate model profile ${profileKey}.`,
      );
    }

    profileKeys.add(profileKey);
    return normalizedModelConfig;
  });

  return { models };
}

function normalizeStepModelConfig(
  operation: AiProcessingOperation,
  modelConfig: AiProcessingStepModelConfigJson,
  modelsByKey: Map<string, AiModelJson>,
): AiProcessingStepModelConfigJson {
  const normalizedModelConfig = {
    ...modelConfig,
    modelId: modelConfig.modelId.trim(),
    profileName: modelConfig.profileName.trim(),
  };
  const modelKey = getAiModelKey(
    normalizedModelConfig.provider,
    normalizedModelConfig.modelId,
  );
  const model = modelsByKey.get(modelKey);

  if (!model) {
    throw new BadRequestException(
      `AI processing step ${operation} references unknown model ${modelKey}.`,
    );
  }

  if (!getModelProfile(model, normalizedModelConfig.profileName)) {
    throw new BadRequestException(
      `AI processing step ${operation} references unknown model profile ${modelKey}/${normalizedModelConfig.profileName}.`,
    );
  }

  return normalizedModelConfig;
}

function getModelProfile(
  model: AiModelJson,
  profileName: string,
): AiModelProfileJson | undefined {
  return model.profiles.find((profile) => profile.name === profileName);
}

function getAiModelKey(provider: AiModelProvider, modelId: string): string {
  return `${provider}${AI_MODEL_KEY_SEPARATOR}${modelId}`;
}

function getAiProfileKey(modelConfig: AiProcessingStepModelConfigJson): string {
  return `${getAiModelKey(
    modelConfig.provider,
    modelConfig.modelId,
  )}${AI_MODEL_KEY_SEPARATOR}${modelConfig.profileName}`;
}

function parseModelParametersJson(input: {
  label: string;
  parametersJson: string;
}): AiGenerationModelParameters {
  const parametersJson = input.parametersJson.trim();
  return parametersJson ? parseJsonObject(input) : {};
}

function parseJsonObject(input: {
  label: string;
  parametersJson: string;
}): Record<string, unknown> {
  let value: unknown;

  try {
    value = JSON.parse(input.parametersJson);
  } catch {
    throw new BadRequestException(
      `${input.label} parametersJson must be valid JSON.`,
    );
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(
      `${input.label} parametersJson must be a JSON object.`,
    );
  }

  return value as Record<string, unknown>;
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
