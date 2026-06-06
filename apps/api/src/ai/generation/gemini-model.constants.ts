import { ThinkingLevel } from "@google/genai";
import type { GenerateContentConfig } from "@google/genai";
import type { AiGenerationModelConfig } from "@/ai/config/ai-processing-config.service";
import type { AiThinkingLevel } from "@/ai/config/ai-processing-config-schemas";

const GEMINI_THINKING_BUDGET = 16_000;

export function buildGeminiGenerateContentConfig(
  stepConfig: AiGenerationModelConfig,
  config: Omit<GenerateContentConfig, "thinkingConfig">,
): GenerateContentConfig {
  return {
    ...config,
    thinkingConfig: buildGeminiThinkingConfig(stepConfig),
  };
}

function buildGeminiThinkingConfig(
  stepConfig: AiGenerationModelConfig,
): NonNullable<GenerateContentConfig["thinkingConfig"]> {
  if (stepConfig.thinkingMode === "BUDGET") {
    return {
      thinkingBudget: GEMINI_THINKING_BUDGET,
    };
  }

  if (!stepConfig.thinkingLevel) {
    throw new Error(
      `AI model ${stepConfig.modelId} requires a thinking level.`,
    );
  }

  return {
    thinkingLevel: GEMINI_THINKING_LEVEL_BY_CONFIG[stepConfig.thinkingLevel],
  };
}

const GEMINI_THINKING_LEVEL_BY_CONFIG = {
  LOW: ThinkingLevel.LOW,
  MEDIUM: ThinkingLevel.MEDIUM,
  HIGH: ThinkingLevel.HIGH,
} satisfies Record<AiThinkingLevel, ThinkingLevel>;
