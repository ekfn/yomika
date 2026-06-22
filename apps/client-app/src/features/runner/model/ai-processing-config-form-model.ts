import {
  AiModelProvider,
  AiProcessingStep,
  type AiProcessingConfigFieldsFragment,
} from "@/graphql/generated/graphql";

export type AiProcessingConfigForm = {
  models: AiModelForm[];
  steps: Record<AiProcessingStep, StepConfigForm>;
};

export type AiModelForm = {
  provider: AiModelProvider;
  modelId: string;
  requestsPerMinute: number;
  profiles: AiModelProfileForm[];
};

export type AiModelProfileForm = {
  name: string;
  parametersJson: string;
};

export type StepConfigForm = {
  models: StepModelConfigForm[];
};

export type StepModelConfigForm = {
  provider: AiModelProvider;
  modelId: string;
  profileName: string;
};

export type ModelProfileOption = StepModelConfigForm & {
  key: string;
  modelKey: string;
};

export const STEP_ORDER = [
  AiProcessingStep.Cleanup,
  AiProcessingStep.Split,
  AiProcessingStep.Translation,
  AiProcessingStep.Vocabulary,
] as const;

export const PROVIDER_OPTIONS = [
  AiModelProvider.GithubModels,
  AiModelProvider.Gemini,
] as const;

export const STEP_LABELS = {
  [AiProcessingStep.Cleanup]: "Cleanup",
  [AiProcessingStep.Split]: "Split",
  [AiProcessingStep.Translation]: "Translation",
  [AiProcessingStep.Vocabulary]: "Vocabulary",
} satisfies Record<AiProcessingStep, string>;

export const PROVIDER_LABELS = {
  [AiModelProvider.Gemini]: "Gemini",
  [AiModelProvider.GithubModels]: "GitHub Models",
} satisfies Record<AiModelProvider, string>;

const DEFAULT_PROFILE_NAME = "Default";
const DEFAULT_REQUESTS_PER_MINUTE = 10;
const MODEL_KEY_SEPARATOR = "__";

export function getModelKey(
  model: Pick<AiModelForm, "provider" | "modelId">,
): string {
  return `${model.provider}${MODEL_KEY_SEPARATOR}${model.modelId.trim()}`;
}

export function getProfileKey(model: StepModelConfigForm): string {
  return `${getModelKey(model)}${MODEL_KEY_SEPARATOR}${model.profileName.trim()}`;
}

export function getModelProfileOptions(
  form: AiProcessingConfigForm,
): ModelProfileOption[] {
  return form.models.flatMap((model) =>
    model.profiles
      .filter(
        (profile) =>
          model.modelId.trim().length > 0 && profile.name.trim().length > 0,
      )
      .map((profile) => ({
        provider: model.provider,
        modelId: model.modelId,
        profileName: profile.name,
        modelKey: getModelKey(model),
        key: getProfileKey({
          provider: model.provider,
          modelId: model.modelId,
          profileName: profile.name,
        }),
      })),
  );
}

export function toFormState(
  config: AiProcessingConfigFieldsFragment,
): AiProcessingConfigForm {
  const models = config.models.map((model) => ({
    provider: model.provider,
    modelId: model.modelId,
    requestsPerMinute: model.requestsPerMinute,
    profiles: model.profiles.map((profile) => ({
      name: profile.name,
      parametersJson: profile.parametersJson,
    })),
  }));
  const fallbackModelConfig = getFallbackStepModelConfig(models);

  return {
    models,
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
                    provider: modelConfig.provider,
                    modelId: modelConfig.modelId,
                    profileName: modelConfig.profileName,
                  }))
                : fallbackModelConfig
                  ? [fallbackModelConfig]
                  : [],
          },
        ];
      }),
    ) as AiProcessingConfigForm["steps"],
  };
}

export function toUpdateInput(form: AiProcessingConfigForm) {
  return {
    models: form.models.map((model) => ({
      provider: model.provider,
      modelId: model.modelId,
      requestsPerMinute: model.requestsPerMinute,
      profiles: model.profiles.map((profile) => ({
        name: profile.name,
        parametersJson: profile.parametersJson,
      })),
    })),
    steps: STEP_ORDER.map((step) => {
      const stepConfig = form.steps[step];

      return {
        step,
        models: stepConfig.models.map((modelConfig) => ({
          provider: modelConfig.provider,
          modelId: modelConfig.modelId,
          profileName: modelConfig.profileName,
        })),
      };
    }),
  };
}

export function validateModelsForm(form: AiProcessingConfigForm): string[] {
  const errors: string[] = [];
  const modelsByKey = new Map<string, AiModelForm>();

  if (form.models.length === 0) {
    errors.push("At least one model is required.");
  }

  for (const model of form.models) {
    const modelId = model.modelId.trim();
    const modelKey = getModelKey(model);
    const profileNames = new Set<string>();

    if (!modelId) {
      errors.push("Model ID is required.");
      continue;
    }

    if (modelsByKey.has(modelKey)) {
      errors.push(`Duplicate model ${modelKey}.`);
    }

    if (
      !Number.isFinite(model.requestsPerMinute) ||
      !Number.isInteger(model.requestsPerMinute) ||
      model.requestsPerMinute < 1
    ) {
      errors.push(
        `Requests/min for model ${modelKey} must be a positive integer.`,
      );
    }

    if (model.profiles.length === 0) {
      errors.push(`Model ${modelKey} must include at least one profile.`);
    }

    for (const profile of model.profiles) {
      const profileName = profile.name.trim();

      if (!profileName) {
        errors.push(`Profile name is required for model ${modelKey}.`);
        continue;
      }

      if (profileNames.has(profileName)) {
        errors.push(
          `Model ${modelKey} includes duplicate profile ${profileName}.`,
        );
      }

      profileNames.add(profileName);
      errors.push(
        ...validateParametersJson(
          profile.parametersJson,
          `${modelKey}/${profileName}`,
        ),
      );
    }

    modelsByKey.set(modelKey, model);
  }

  return [...new Set(errors)];
}

export function validateAiProcessingSettingsForm(
  form: AiProcessingConfigForm,
): string[] {
  const errors: string[] = [];
  const modelsByKey = new Map(
    form.models
      .filter((model) => model.modelId.trim().length > 0)
      .map((model) => [getModelKey(model), model] as const),
  );

  for (const step of STEP_ORDER) {
    const stepConfig = form.steps[step];
    const profileKeys = new Set<string>();

    if (stepConfig.models.length === 0) {
      errors.push(
        `${STEP_LABELS[step]} must include at least one model profile.`,
      );
      continue;
    }

    for (const modelConfig of stepConfig.models) {
      const modelId = modelConfig.modelId.trim();
      const profileName = modelConfig.profileName.trim();
      const modelKey = getModelKey(modelConfig);
      const profileKey = getProfileKey(modelConfig);
      const model = modelsByKey.get(modelKey);

      if (!modelId) {
        errors.push(`${STEP_LABELS[step]} references an empty model ID.`);
        continue;
      }

      if (!profileName) {
        errors.push(`${STEP_LABELS[step]} references an empty profile name.`);
        continue;
      }

      if (profileKeys.has(profileKey)) {
        errors.push(
          `${STEP_LABELS[step]} includes duplicate model profile ${profileKey}.`,
        );
      }

      profileKeys.add(profileKey);

      if (!model) {
        errors.push(`${STEP_LABELS[step]} references an unknown model.`);
        continue;
      }

      if (!model.profiles.some((profile) => profile.name === profileName)) {
        errors.push(
          `${STEP_LABELS[step]} references an unknown model profile.`,
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

export function hasModelsChanges(
  form: AiProcessingConfigForm,
  config: AiProcessingConfigFieldsFragment | undefined,
): boolean {
  if (!config) {
    return false;
  }

  return (
    JSON.stringify(toUpdateInput(form).models) !==
    JSON.stringify(toUpdateInput(toFormState(config)).models)
  );
}

export function addModel(form: AiProcessingConfigForm): AiProcessingConfigForm {
  return {
    ...form,
    models: [
      ...form.models,
      {
        provider: AiModelProvider.GithubModels,
        modelId: "",
        requestsPerMinute: DEFAULT_REQUESTS_PER_MINUTE,
        profiles: [
          {
            name: DEFAULT_PROFILE_NAME,
            parametersJson: "",
          },
        ],
      },
    ],
  };
}

export function updateModel(
  form: AiProcessingConfigForm,
  index: number,
  nextModel: AiModelForm,
): AiProcessingConfigForm {
  const previousModel = form.models[index];
  const previousModelKey = previousModel ? getModelKey(previousModel) : null;
  const models = form.models.map((model, modelIndex) =>
    modelIndex === index ? nextModel : model,
  );

  return {
    models,
    steps: Object.fromEntries(
      STEP_ORDER.map((step) => [
        step,
        {
          models: form.steps[step].models.map((modelConfig) => {
            if (
              !previousModel ||
              getModelKey(modelConfig) !== previousModelKey
            ) {
              return modelConfig;
            }

            return {
              provider: nextModel.provider,
              modelId: nextModel.modelId,
              profileName: getExistingOrFallbackProfileName(
                nextModel,
                modelConfig.profileName,
              ),
            };
          }),
        },
      ]),
    ) as AiProcessingConfigForm["steps"],
  };
}

export function removeModel(
  form: AiProcessingConfigForm,
  index: number,
): AiProcessingConfigForm {
  const removedModel = form.models[index];
  const removedModelKey = removedModel ? getModelKey(removedModel) : null;
  const models = form.models.filter(
    (_model, modelIndex) => modelIndex !== index,
  );
  const replacementModelConfig = getFallbackStepModelConfig(models);

  return {
    models,
    steps: Object.fromEntries(
      STEP_ORDER.map((step) => [
        step,
        {
          models: form.steps[step].models.map((modelConfig) => {
            if (
              !removedModelKey ||
              getModelKey(modelConfig) !== removedModelKey
            ) {
              return modelConfig;
            }

            return (
              replacementModelConfig ?? {
                provider: AiModelProvider.GithubModels,
                modelId: "",
                profileName: "",
              }
            );
          }),
        },
      ]),
    ) as AiProcessingConfigForm["steps"],
  };
}

export function addModelProfile(
  form: AiProcessingConfigForm,
  modelIndex: number,
): AiProcessingConfigForm {
  const model = form.models[modelIndex];

  if (!model) {
    return form;
  }

  return updateModel(form, modelIndex, {
    ...model,
    profiles: [
      ...model.profiles,
      {
        name: getNextProfileName(model.profiles),
        parametersJson: "",
      },
    ],
  });
}

export function updateModelProfile(
  form: AiProcessingConfigForm,
  modelIndex: number,
  profileIndex: number,
  nextProfile: AiModelProfileForm,
): AiProcessingConfigForm {
  const model = form.models[modelIndex];
  const previousProfile = model?.profiles[profileIndex];

  if (!model || !previousProfile) {
    return form;
  }

  const nextModel = {
    ...model,
    profiles: model.profiles.map((profile, index) =>
      index === profileIndex ? nextProfile : profile,
    ),
  };

  return {
    models: form.models.map((candidate, index) =>
      index === modelIndex ? nextModel : candidate,
    ),
    steps: Object.fromEntries(
      STEP_ORDER.map((step) => [
        step,
        {
          models: form.steps[step].models.map((modelConfig) => {
            if (
              getModelKey(modelConfig) === getModelKey(model) &&
              modelConfig.profileName === previousProfile.name
            ) {
              return {
                ...modelConfig,
                profileName: nextProfile.name,
              };
            }

            return modelConfig;
          }),
        },
      ]),
    ) as AiProcessingConfigForm["steps"],
  };
}

export function removeModelProfile(
  form: AiProcessingConfigForm,
  modelIndex: number,
  profileIndex: number,
): AiProcessingConfigForm {
  const model = form.models[modelIndex];
  const removedProfile = model?.profiles[profileIndex];

  if (!model || !removedProfile || model.profiles.length <= 1) {
    return form;
  }

  const profiles = model.profiles.filter(
    (_profile, index) => index !== profileIndex,
  );
  const replacementProfileName = profiles[0]?.name ?? "";
  const nextModel = { ...model, profiles };

  return {
    models: form.models.map((candidate, index) =>
      index === modelIndex ? nextModel : candidate,
    ),
    steps: Object.fromEntries(
      STEP_ORDER.map((step) => [
        step,
        {
          models: form.steps[step].models.map((modelConfig) => {
            if (
              getModelKey(modelConfig) === getModelKey(model) &&
              modelConfig.profileName === removedProfile.name
            ) {
              return {
                ...modelConfig,
                profileName: replacementProfileName,
              };
            }

            return modelConfig;
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
  const modelConfig = getFallbackStepModelConfig(form.models);

  return {
    models: [...stepConfig.models, modelConfig].filter(
      (config): config is StepModelConfigForm => Boolean(config),
    ),
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

function getFallbackStepModelConfig(
  models: AiModelForm[],
): StepModelConfigForm | null {
  const model =
    models.find(
      (candidate) =>
        candidate.modelId.trim().length > 0 && candidate.profiles.length > 0,
    ) ?? models[0];
  const profile = model?.profiles[0];

  return model && profile
    ? {
        provider: model.provider,
        modelId: model.modelId,
        profileName: profile.name,
      }
    : null;
}

function getExistingOrFallbackProfileName(
  model: AiModelForm,
  profileName: string,
): string {
  return model.profiles.some((profile) => profile.name === profileName)
    ? profileName
    : (model.profiles[0]?.name ?? "");
}

function validateParametersJson(
  parametersJson: string,
  label: string,
): string[] {
  const trimmedParametersJson = parametersJson.trim();

  if (!trimmedParametersJson) {
    return [];
  }

  const parsed = parseParametersJson(trimmedParametersJson);

  if (!parsed.ok) {
    return [`Parameters JSON for ${label} must be valid JSON.`];
  }

  if (
    typeof parsed.value !== "object" ||
    parsed.value === null ||
    Array.isArray(parsed.value)
  ) {
    return [`Parameters JSON for ${label} must be a JSON object.`];
  }

  return [];
}

function parseParametersJson(
  parametersJson: string,
): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(parametersJson) };
  } catch {
    return { ok: false };
  }
}

function getNextProfileName(profiles: AiModelProfileForm[]): string {
  const existingNames = new Set(profiles.map((profile) => profile.name));

  if (!existingNames.has(DEFAULT_PROFILE_NAME)) {
    return DEFAULT_PROFILE_NAME;
  }

  let index = 2;

  while (existingNames.has(`${DEFAULT_PROFILE_NAME} ${index}`)) {
    index += 1;
  }

  return `${DEFAULT_PROFILE_NAME} ${index}`;
}
