import {
  AiProcessingStep,
  AiThinkingLevel,
  AiThinkingMode,
  type AiProcessingConfigFieldsFragment,
} from "@/graphql/generated/graphql";

export type AiProcessingConfigForm = {
  modelOptions: ModelOptionForm[];
  steps: Record<AiProcessingStep, StepConfigForm>;
};

export type ModelOptionForm = {
  id: string;
  thinkingMode: AiThinkingMode;
  requestsPerMinute: number;
};

export type StepConfigForm = {
  models: StepModelConfigForm[];
};

export type StepModelConfigForm = {
  modelId: string;
  thinkingLevel: AiThinkingLevel | null;
};

export const STEP_ORDER = [
  AiProcessingStep.Cleanup,
  AiProcessingStep.Split,
  AiProcessingStep.Translation,
  AiProcessingStep.Vocabulary,
] as const;

export const THINKING_LEVEL_ORDER = [
  AiThinkingLevel.Low,
  AiThinkingLevel.Medium,
  AiThinkingLevel.High,
] as const;

export const THINKING_MODE_OPTIONS = [
  AiThinkingMode.Budget,
  AiThinkingMode.Level,
] as const;

export const STEP_LABELS = {
  [AiProcessingStep.Cleanup]: "Cleanup",
  [AiProcessingStep.Split]: "Split",
  [AiProcessingStep.Translation]: "Translation",
  [AiProcessingStep.Vocabulary]: "Vocabulary",
} satisfies Record<AiProcessingStep, string>;

export const THINKING_MODE_LABELS = {
  [AiThinkingMode.Budget]: "Fixed budget",
  [AiThinkingMode.Level]: "Thinking level",
} satisfies Record<AiThinkingMode, string>;

export const THINKING_LEVEL_LABELS = {
  [AiThinkingLevel.Low]: "Low",
  [AiThinkingLevel.Medium]: "Medium",
  [AiThinkingLevel.High]: "High",
} satisfies Record<AiThinkingLevel, string>;

const DEFAULT_THINKING_LEVEL = AiThinkingLevel.High;
const DEFAULT_REQUESTS_PER_MINUTE = 10;

export function toFormState(
  config: AiProcessingConfigFieldsFragment,
): AiProcessingConfigForm {
  const modelOptions = config.modelOptions.map((option) => ({
    id: option.id,
    thinkingMode: option.thinkingMode,
    requestsPerMinute: option.requestsPerMinute,
  }));
  const fallbackModelOption = modelOptions[0];
  const fallbackModelConfig = normalizeStepModelForModel(
    {
      modelId: fallbackModelOption?.id ?? "",
      thinkingLevel: null,
    },
    fallbackModelOption,
  );

  return {
    modelOptions,
    steps: Object.fromEntries(
      STEP_ORDER.map((step) => {
        const stepConfig = config.steps.find(
          (candidate) => candidate.step === step,
        );
        const configuredModels = stepConfig?.models ?? [];

        return [
          step,
          {
            models:
              configuredModels.length > 0
                ? configuredModels.map((modelConfig) => ({
                    modelId: modelConfig.modelId,
                    thinkingLevel: modelConfig.thinkingLevel ?? null,
                  }))
                : [fallbackModelConfig],
          },
        ];
      }),
    ) as AiProcessingConfigForm["steps"],
  };
}

export function toUpdateInput(form: AiProcessingConfigForm) {
  return {
    modelOptions: form.modelOptions.map((option) => ({
      id: option.id,
      thinkingMode: option.thinkingMode,
      requestsPerMinute: option.requestsPerMinute,
    })),
    steps: STEP_ORDER.map((step) => {
      const stepConfig = form.steps[step];

      return {
        step,
        models: stepConfig.models.map((modelConfig) => {
          const modelOption = form.modelOptions.find(
            (option) => option.id === modelConfig.modelId,
          );

          return {
            modelId: modelConfig.modelId,
            thinkingLevel:
              modelOption?.thinkingMode === AiThinkingMode.Level
                ? modelConfig.thinkingLevel
                : null,
          };
        }),
      };
    }),
  };
}

export function validateModelOptionsForm(
  form: AiProcessingConfigForm,
): string[] {
  const errors: string[] = [];
  const modelOptionsById = new Map<string, ModelOptionForm>();

  if (form.modelOptions.length === 0) {
    errors.push("At least one model option is required.");
  }

  for (const option of form.modelOptions) {
    const modelId = option.id.trim();

    if (!modelId) {
      errors.push("Model ID is required.");
      continue;
    }

    if (modelOptionsById.has(modelId)) {
      errors.push(`Duplicate model ID ${modelId}.`);
    }

    if (
      !Number.isFinite(option.requestsPerMinute) ||
      !Number.isInteger(option.requestsPerMinute) ||
      option.requestsPerMinute < 1
    ) {
      errors.push(
        `Requests/min for model ${modelId} must be a positive integer.`,
      );
    }

    modelOptionsById.set(modelId, option);
  }

  return [...new Set(errors)];
}

export function validateAiProcessingSettingsForm(
  form: AiProcessingConfigForm,
): string[] {
  const errors: string[] = [];
  const modelOptionsById = new Map(
    form.modelOptions
      .map((option) => [option.id.trim(), option] as const)
      .filter(([modelId]) => modelId.length > 0),
  );

  for (const step of STEP_ORDER) {
    const stepConfig = form.steps[step];
    const stepModelIds = new Set<string>();

    if (stepConfig.models.length === 0) {
      errors.push(`${STEP_LABELS[step]} must include at least one model.`);
      continue;
    }

    for (const modelConfig of stepConfig.models) {
      const modelId = modelConfig.modelId.trim();
      const modelOption = modelOptionsById.get(modelId);

      if (!modelId) {
        errors.push(`${STEP_LABELS[step]} references an empty model.`);
        continue;
      }

      if (stepModelIds.has(modelId)) {
        errors.push(
          `${STEP_LABELS[step]} includes duplicate model ${modelId}.`,
        );
      }

      stepModelIds.add(modelId);

      if (!modelOption) {
        errors.push(`${STEP_LABELS[step]} references an unknown model.`);
        continue;
      }

      if (modelOption.thinkingMode !== AiThinkingMode.Level) {
        continue;
      }

      if (!modelConfig.thinkingLevel) {
        errors.push(
          `${STEP_LABELS[step]} must select a thinking level for ${modelId}.`,
        );
      }
    }
  }

  return [...new Set(errors)];
}

export function hasAiProcessingSettingsChanges(
  form: AiProcessingConfigForm,
  config: AiProcessingConfigFieldsFragment | undefined,
): boolean {
  if (!config) {
    return false;
  }

  return (
    JSON.stringify(toUpdateInput(form).steps) !==
    JSON.stringify(toUpdateInput(toFormState(config)).steps)
  );
}

export function hasModelOptionsChanges(
  form: AiProcessingConfigForm,
  config: AiProcessingConfigFieldsFragment | undefined,
): boolean {
  if (!config) {
    return false;
  }

  return (
    JSON.stringify(toUpdateInput(form).modelOptions) !==
    JSON.stringify(toUpdateInput(toFormState(config)).modelOptions)
  );
}

export function addModelOption(
  form: AiProcessingConfigForm,
): AiProcessingConfigForm {
  const modelId = getNextModelId(form.modelOptions);

  return {
    ...form,
    modelOptions: [
      ...form.modelOptions,
      {
        id: modelId,
        thinkingMode: AiThinkingMode.Budget,
        requestsPerMinute: DEFAULT_REQUESTS_PER_MINUTE,
      },
    ],
  };
}

export function updateModelOption(
  form: AiProcessingConfigForm,
  index: number,
  nextOption: ModelOptionForm,
): AiProcessingConfigForm {
  const previousOption = form.modelOptions[index];
  const modelOptions = form.modelOptions.map((option, optionIndex) =>
    optionIndex === index ? nextOption : option,
  );

  return {
    modelOptions,
    steps: Object.fromEntries(
      STEP_ORDER.map((step) => [
        step,
        {
          models: form.steps[step].models.map((modelConfig) => {
            const modelId =
              previousOption && modelConfig.modelId === previousOption.id
                ? nextOption.id
                : modelConfig.modelId;
            const modelOption =
              modelId === nextOption.id
                ? nextOption
                : modelOptions.find((option) => option.id === modelId);

            return normalizeStepModelForModel(
              {
                ...modelConfig,
                modelId,
              },
              modelOption,
            );
          }),
        },
      ]),
    ) as AiProcessingConfigForm["steps"],
  };
}

export function removeModelOption(
  form: AiProcessingConfigForm,
  index: number,
): AiProcessingConfigForm {
  const removedOption = form.modelOptions[index];
  const modelOptions = form.modelOptions.filter(
    (_option, optionIndex) => optionIndex !== index,
  );
  const replacementModel = modelOptions[0];

  return {
    modelOptions,
    steps: Object.fromEntries(
      STEP_ORDER.map((step) => [
        step,
        {
          models: form.steps[step].models.map((modelConfig) => {
            if (!removedOption || modelConfig.modelId !== removedOption.id) {
              return modelConfig;
            }

            return normalizeStepModelForModel(
              {
                modelId: replacementModel?.id ?? "",
                thinkingLevel: null,
              },
              replacementModel,
            );
          }),
        },
      ]),
    ) as AiProcessingConfigForm["steps"],
  };
}

export function updateStepModelConfig(
  stepConfig: StepConfigForm,
  index: number,
  nextModelConfig: StepModelConfigForm,
): StepConfigForm {
  return {
    models: stepConfig.models.map((modelConfig, modelIndex) =>
      modelIndex === index ? nextModelConfig : modelConfig,
    ),
  };
}

export function addStepModelConfig(
  stepConfig: StepConfigForm,
  form: AiProcessingConfigForm,
): StepConfigForm {
  const modelOption =
    form.modelOptions.find((option) => option.id.trim().length > 0) ??
    form.modelOptions[0];

  return {
    models: [
      ...stepConfig.models,
      normalizeStepModelForModel(
        {
          modelId: modelOption?.id ?? "",
          thinkingLevel: null,
        },
        modelOption,
      ),
    ],
  };
}

export function moveStepModelConfig(
  stepConfig: StepConfigForm,
  fromIndex: number,
  toIndex: number,
): StepConfigForm {
  const models = [...stepConfig.models];
  const [modelConfig] = models.splice(fromIndex, 1);

  if (!modelConfig) {
    return stepConfig;
  }

  models.splice(toIndex, 0, modelConfig);
  return { models };
}

export function removeStepModelConfig(
  stepConfig: StepConfigForm,
  index: number,
): StepConfigForm {
  if (stepConfig.models.length <= 1) {
    return stepConfig;
  }

  return {
    models: stepConfig.models.filter(
      (_modelConfig, modelIndex) => modelIndex !== index,
    ),
  };
}

export function normalizeStepModelForModel(
  modelConfig: StepModelConfigForm,
  modelOption: ModelOptionForm | undefined,
): StepModelConfigForm {
  if (!modelOption || modelOption.thinkingMode !== AiThinkingMode.Level) {
    return {
      ...modelConfig,
      thinkingLevel: null,
    };
  }

  return {
    ...modelConfig,
    thinkingLevel: modelConfig.thinkingLevel ?? DEFAULT_THINKING_LEVEL,
  };
}

function getNextModelId(modelOptions: ModelOptionForm[]): string {
  const existingIds = new Set(modelOptions.map((option) => option.id));
  const baseId = "gemini-new-model";

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let index = 2;

  while (existingIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}
