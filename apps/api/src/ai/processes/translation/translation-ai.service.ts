import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  AI_JSON_GENERATION_CLIENT,
  type AiJsonGenerationClient,
} from "@/ai/generation/ai-json-generation-client";
import type {
  AiTranslateInput,
  AiTranslateResult,
} from "../../ai-processing-client";
import { buildTranslationPrompt } from "./translation-prompt";
import { normalizeTextWithReading } from "./text-with-reading-normalization";

const translationResponseSchema = z.object({
  segments: z.array(
    z.object({
      id: z.string().min(1),
      text: z.string(),
      translation: z.string(),
      textWithReading: z.string(),
    }),
  ),
});

const translationResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["segments"],
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "textWithReading", "translation"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          textWithReading: { type: "string" },
          translation: { type: "string" },
        },
      },
    },
  },
};

@Injectable()
export class TranslationAiService {
  constructor(
    @Inject(AI_JSON_GENERATION_CLIENT)
    private readonly jsonGenerationClient: AiJsonGenerationClient,
  ) {}

  async translate(input: AiTranslateInput): Promise<AiTranslateResult> {
    const prompt = buildTranslationPrompt(input);

    const parsed = translationResponseSchema.parse(
      await this.jsonGenerationClient.generateJson({
        operation: "translation",
        operationName: "translation",
        prompt,
        responseJsonSchema: translationResponseJsonSchema,
      }),
    );

    return this.validateTranslationResult(input, parsed.segments);
  }

  private validateTranslationResult(
    input: AiTranslateInput,
    segments: Array<{
      id: string;
      text: string;
      translation: string;
      textWithReading: string;
    }>,
  ): AiTranslateResult {
    const expectedSegments = new Map(
      input.segments.map((segment) => [segment.id, segment.text] as const),
    );
    const translationById = new Map<
      string,
      { text: string; translation: string; textWithReading: string }
    >();

    for (const segment of segments) {
      if (!expectedSegments.has(segment.id)) {
        throw new Error(
          `AI translation returned unexpected segment id ${segment.id}.`,
        );
      }

      if (translationById.has(segment.id)) {
        throw new Error(
          `AI translation returned duplicate segment id ${segment.id}.`,
        );
      }

      translationById.set(segment.id, {
        text: segment.text,
        translation: segment.translation,
        textWithReading: segment.textWithReading,
      });
    }

    if (translationById.size !== expectedSegments.size) {
      const missingIds = [...expectedSegments.keys()].filter(
        (id) => !translationById.has(id),
      );

      throw new Error(
        `AI translation omitted ${missingIds.length} segment(s): ${missingIds.join(", ")}.`,
      );
    }

    return {
      segments: [...expectedSegments.entries()].map(([id, text]) => {
        const translation = translationById.get(id);

        if (!translation) {
          throw new Error(`AI translation omitted segment ${id}.`);
        }

        return {
          id,
          text,
          translation: translation.translation,
          textWithReading: normalizeTextWithReading({
            sourceText: text,
            textWithReading: translation.textWithReading,
          }),
        };
      }),
    };
  }
}
