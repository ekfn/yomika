import { BadRequestException, UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@/auth/auth.guard";
import {
  AI_PROCESSING_OPERATION_VALUES,
  type AiModelProvider,
  type AiProcessingConfigJson,
  type AiProcessingOperation,
  type AiProcessingStepModelConfigJson,
  type AiProcessingStepConfigJson,
} from "./ai-processing-config-schemas";
import { AiProcessingConfigService } from "./ai-processing-config.service";

type AiProcessingStepValue = "CLEANUP" | "SPLIT" | "TRANSLATION" | "VOCABULARY";
type AiModelProviderValue = "GEMINI" | "GITHUB_MODELS";

type AiModelProfileOutput = {
  name: string;
  parametersJson: string;
};

type AiModelOutput = {
  provider: AiModelProviderValue;
  modelId: string;
  requestsPerMinute: number;
  profiles: AiModelProfileOutput[];
};

type AiProcessingStepModelConfigOutput = {
  provider: AiModelProviderValue;
  modelId: string;
  profileName: string;
};

type AiProcessingStepConfigOutput = {
  step: AiProcessingStepValue;
  models: AiProcessingStepModelConfigOutput[];
};

type AiProcessingConfigOutput = {
  models: AiModelOutput[];
  steps: AiProcessingStepConfigOutput[];
};

type AiModelProfileInput = {
  name: string;
  parametersJson: string;
};

type AiModelInput = {
  provider: AiModelProviderValue;
  modelId: string;
  requestsPerMinute: number;
  profiles: AiModelProfileInput[];
};

type AiProcessingStepModelConfigInput = {
  provider: AiModelProviderValue;
  modelId: string;
  profileName: string;
};

type AiProcessingStepConfigInput = {
  step: AiProcessingStepValue;
  models: AiProcessingStepModelConfigInput[];
};

type UpdateAiProcessingConfigInput = {
  models: AiModelInput[];
  steps: AiProcessingStepConfigInput[];
};

const GRAPHQL_STEP_BY_OPERATION = {
  cleanup: "CLEANUP",
  split: "SPLIT",
  translation: "TRANSLATION",
  vocabulary: "VOCABULARY",
} satisfies Record<AiProcessingOperation, AiProcessingStepValue>;

const OPERATION_BY_GRAPHQL_STEP = {
  CLEANUP: "cleanup",
  SPLIT: "split",
  TRANSLATION: "translation",
  VOCABULARY: "vocabulary",
} satisfies Record<AiProcessingStepValue, AiProcessingOperation>;

const GRAPHQL_PROVIDER_BY_MODEL_PROVIDER = {
  gemini: "GEMINI",
  "github-models": "GITHUB_MODELS",
} satisfies Record<AiModelProvider, AiModelProviderValue>;

const MODEL_PROVIDER_BY_GRAPHQL_PROVIDER = {
  GEMINI: "gemini",
  GITHUB_MODELS: "github-models",
} satisfies Record<AiModelProviderValue, AiModelProvider>;

@Resolver()
@UseGuards(AuthGuard)
export class AiProcessingConfigResolver {
  constructor(
    private readonly aiProcessingConfigService: AiProcessingConfigService,
  ) {}

  @Query("aiProcessingConfig")
  async aiProcessingConfig(): Promise<AiProcessingConfigOutput> {
    return toAiProcessingConfigOutput(
      await this.aiProcessingConfigService.getConfig(),
    );
  }

  @Mutation("updateAiProcessingConfig")
  async updateAiProcessingConfig(
    @Args("input") input: UpdateAiProcessingConfigInput,
  ): Promise<AiProcessingConfigOutput> {
    return toAiProcessingConfigOutput(
      await this.aiProcessingConfigService.updateConfig(
        toAiProcessingConfigJson(input),
      ),
    );
  }
}

function toAiProcessingConfigOutput(
  config: AiProcessingConfigJson,
): AiProcessingConfigOutput {
  return {
    models: config.models.map((model) => ({
      provider: GRAPHQL_PROVIDER_BY_MODEL_PROVIDER[model.provider],
      modelId: model.modelId,
      requestsPerMinute: model.requestsPerMinute,
      profiles: model.profiles,
    })),
    steps: AI_PROCESSING_OPERATION_VALUES.map((operation) => ({
      step: GRAPHQL_STEP_BY_OPERATION[operation],
      models: config.steps[operation].models.map((model) => ({
        provider: GRAPHQL_PROVIDER_BY_MODEL_PROVIDER[model.provider],
        modelId: model.modelId,
        profileName: model.profileName,
      })),
    })),
  };
}

function toAiProcessingConfigJson(
  input: UpdateAiProcessingConfigInput,
): AiProcessingConfigJson {
  return {
    models: input.models.map((model) => ({
      provider: MODEL_PROVIDER_BY_GRAPHQL_PROVIDER[model.provider],
      modelId: model.modelId,
      requestsPerMinute: model.requestsPerMinute,
      profiles: model.profiles,
    })),
    steps: toStepConfigJson(input.steps),
  };
}

function toStepConfigJson(
  inputSteps: AiProcessingStepConfigInput[],
): AiProcessingConfigJson["steps"] {
  const stepsByOperation = new Map<
    AiProcessingOperation,
    AiProcessingStepConfigJson
  >();

  for (const step of inputSteps) {
    const operation = OPERATION_BY_GRAPHQL_STEP[step.step];

    if (stepsByOperation.has(operation)) {
      throw new BadRequestException(
        `Duplicate AI processing step ${step.step}.`,
      );
    }

    stepsByOperation.set(operation, {
      models: toStepModelConfigsJson(step.models),
    });
  }

  const missingOperations = AI_PROCESSING_OPERATION_VALUES.filter(
    (operation) => !stepsByOperation.has(operation),
  );

  if (missingOperations.length > 0) {
    throw new BadRequestException(
      `Missing AI processing step(s): ${missingOperations.join(", ")}.`,
    );
  }

  return Object.fromEntries(
    stepsByOperation,
  ) as AiProcessingConfigJson["steps"];
}

function toStepModelConfigsJson(
  models: AiProcessingStepModelConfigInput[],
): AiProcessingStepModelConfigJson[] {
  return models.map((model) => ({
    provider: MODEL_PROVIDER_BY_GRAPHQL_PROVIDER[model.provider],
    modelId: model.modelId,
    profileName: model.profileName,
  }));
}
