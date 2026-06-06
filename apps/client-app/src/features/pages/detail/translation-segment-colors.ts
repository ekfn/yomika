import type { CSSProperties } from "react";

export type TranslationSegmentColorStyle = CSSProperties &
  Record<
    "--translation-segment-color" | "--translation-segment-background",
    string
  >;

export type TranslationSegmentAnalysisColorKind = "reading" | "vocabulary";

const TRANSLATION_SEGMENT_COLORS = [
  {
    background: "oklch(0.63 0.2 20 / 0.14)",
    color: "oklch(0.63 0.2 20)",
  },
  {
    background: "oklch(0.66 0.19 38 / 0.14)",
    color: "oklch(0.66 0.19 38)",
  },
  {
    background: "oklch(0.7 0.17 56 / 0.14)",
    color: "oklch(0.7 0.17 56)",
  },
  {
    background: "oklch(0.72 0.15 74 / 0.14)",
    color: "oklch(0.72 0.15 74)",
  },
  {
    background: "oklch(0.7 0.16 92 / 0.14)",
    color: "oklch(0.7 0.16 92)",
  },
  {
    background: "oklch(0.67 0.17 110 / 0.14)",
    color: "oklch(0.67 0.17 110)",
  },
  {
    background: "oklch(0.64 0.17 128 / 0.14)",
    color: "oklch(0.64 0.17 128)",
  },
  {
    background: "oklch(0.63 0.16 146 / 0.14)",
    color: "oklch(0.63 0.16 146)",
  },
  {
    background: "oklch(0.64 0.15 164 / 0.14)",
    color: "oklch(0.64 0.15 164)",
  },
  {
    background: "oklch(0.66 0.14 182 / 0.14)",
    color: "oklch(0.66 0.14 182)",
  },
  {
    background: "oklch(0.67 0.14 200 / 0.14)",
    color: "oklch(0.67 0.14 200)",
  },
  {
    background: "oklch(0.65 0.15 218 / 0.14)",
    color: "oklch(0.65 0.15 218)",
  },
  {
    background: "oklch(0.62 0.18 236 / 0.14)",
    color: "oklch(0.62 0.18 236)",
  },
  {
    background: "oklch(0.6 0.18 254 / 0.14)",
    color: "oklch(0.6 0.18 254)",
  },
  {
    background: "oklch(0.61 0.19 272 / 0.14)",
    color: "oklch(0.61 0.19 272)",
  },
  {
    background: "oklch(0.63 0.19 290 / 0.14)",
    color: "oklch(0.63 0.19 290)",
  },
  {
    background: "oklch(0.65 0.2 308 / 0.14)",
    color: "oklch(0.65 0.2 308)",
  },
  {
    background: "oklch(0.66 0.2 326 / 0.14)",
    color: "oklch(0.66 0.2 326)",
  },
  {
    background: "oklch(0.65 0.19 344 / 0.14)",
    color: "oklch(0.65 0.19 344)",
  },
  {
    background: "oklch(0.62 0.2 2 / 0.14)",
    color: "oklch(0.62 0.2 2)",
  },
] as const;

const TRANSLATION_SEGMENT_COLOR_STEPS = [1, 3, 7, 9, 11, 13, 17, 19] as const;

function getStableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getTranslationSegmentAnalysisColorStyle(
  segmentId: string,
  analysisKind: TranslationSegmentAnalysisColorKind,
  analysisItemIndex: number,
): TranslationSegmentColorStyle {
  const colorSeed = `${segmentId}:${analysisKind}:color-offset`;
  const stepSeed = `${segmentId}:${analysisKind}:color-step`;
  const offset = getStableHash(colorSeed) % TRANSLATION_SEGMENT_COLORS.length;
  const stepIndex =
    getStableHash(stepSeed) % TRANSLATION_SEGMENT_COLOR_STEPS.length;
  const step =
    TRANSLATION_SEGMENT_COLOR_STEPS[stepIndex] ??
    TRANSLATION_SEGMENT_COLOR_STEPS[0];
  const colorIndex =
    (offset + analysisItemIndex * step) % TRANSLATION_SEGMENT_COLORS.length;
  const color =
    TRANSLATION_SEGMENT_COLORS[colorIndex] ?? TRANSLATION_SEGMENT_COLORS[0];

  return {
    "--translation-segment-background": color.background,
    "--translation-segment-color": color.color,
  };
}
