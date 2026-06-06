import { BadRequestException, UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@/auth/auth.guard";
import {
  AI_PROCESSING_OPERATION_VALUES,
  type AiModelOptionJson,
  type AiProcessingConfigJson,
  type AiProcessingOperation,
  type AiProcessingStepModelConfigJson,
  type AiProcessingStepConfigJson,
  type AiThinkingLevel,
  type AiThinkingMode,
} from "./ai-processing-config-schemas";
import { AiProcessingConfigService } from "./ai-processing-config.service";

type AiProcessingStepValue = "CLEANUP" | "SPLIT" | "TRANSLATION" | "VOCABULARY";

type AiModelOptionOutput = AiModelOptionJson;

type AiProcessingStepConfigOutput = AiProcessingStepConfigJson & {
  step: AiProcessingStepValue;
};

type AiProcessingConfigOutput = {
  modelOptions: AiModelOptionOutput[];
  steps: AiProcessingStepConfigOutput[];
};

type AiModelOptionInput = {
  id: string;
  thinkingMode: AiThinkingMode;
  requestsPerMinute: number;
};

type AiProcessingStepModelConfigInput = {
  modelId: string;
  thinkingLevel?: AiThinkingLevel | null;
};

type AiProcessingStepConfigInput = {
  step: AiProcessingStepValue;
  models: AiProcessingStepModelConfigInput[];
};

type UpdateAiProcessingConfigInput = {
  modelOptions: AiModelOptionInput[];
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
    modelOptions: config.modelOptions,
    steps: AI_PROCESSING_OPERATION_VALUES.map((operation) => ({
      step: GRAPHQL_STEP_BY_OPERATION[operation],
      ...config.steps[operation],
    })),
  };
}

function toAiProcessingConfigJson(
  input: UpdateAiProcessingConfigInput,
): AiProcessingConfigJson {
  return {
    modelOptions: input.modelOptions.map((option) => ({
      id: option.id,
      thinkingMode: option.thinkingMode,
      requestsPerMinute: option.requestsPerMinute,
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
    modelId: model.modelId,
    thinkingLevel: model.thinkingLevel ?? null,
  }));
}
