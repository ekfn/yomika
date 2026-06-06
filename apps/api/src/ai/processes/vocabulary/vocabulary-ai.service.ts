import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  AI_JSON_GENERATION_CLIENT,
  type AiJsonGenerationClient,
} from "@/ai/generation/ai-json-generation-client";
import {
  vocabularyEntryJsonSchema,
  type VocabularyEntryJson,
} from "@/library/library-schemas";
import type {
  AiVocabularyInput,
  AiVocabularyResult,
} from "../../ai-processing-client";
import { buildVocabularyPrompt } from "./vocabulary-prompt";

const vocabularyResponseSchema = z.object({
  segments: z.array(
    z.object({
      id: z.string().min(1),
      vocabulary: z.array(vocabularyEntryJsonSchema),
    }),
  ),
});

const vocabularyResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["segments"],
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "vocabulary"],
        properties: {
          id: { type: "string" },
          vocabulary: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "translation"],
              properties: {
                text: { type: "string" },
                translation: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class VocabularyAiService {
  constructor(
    @Inject(AI_JSON_GENERATION_CLIENT)
    private readonly jsonGenerationClient: AiJsonGenerationClient,
  ) {}

  async extractVocabulary(
    input: AiVocabularyInput,
  ): Promise<AiVocabularyResult> {
    const parsed = vocabularyResponseSchema.parse(
      await this.jsonGenerationClient.generateJson({
        operation: "vocabulary",
        operationName: "vocabulary",
        prompt: buildVocabularyPrompt(input),
        responseJsonSchema: vocabularyResponseJsonSchema,
      }),
    );

    return this.validateVocabularyResult(input, parsed.segments);
  }

  private validateVocabularyResult(
    input: AiVocabularyInput,
    segments: Array<{ id: string; vocabulary: VocabularyEntryJson[] }>,
  ): AiVocabularyResult {
    const expectedIds = new Set(input.segments.map((segment) => segment.id));
    const vocabularyById = new Map<string, VocabularyEntryJson[]>();

    for (const segment of segments) {
      if (!expectedIds.has(segment.id)) {
        throw new Error(
          `AI vocabulary returned unexpected segment id ${segment.id}.`,
        );
      }

      if (vocabularyById.has(segment.id)) {
        throw new Error(
          `AI vocabulary returned duplicate segment id ${segment.id}.`,
        );
      }

      vocabularyById.set(segment.id, segment.vocabulary);
    }

    if (vocabularyById.size !== expectedIds.size) {
      const missingIds = [...expectedIds].filter(
        (id) => !vocabularyById.has(id),
      );

      throw new Error(
        `AI vocabulary omitted ${missingIds.length} segment(s): ${missingIds.join(", ")}.`,
      );
    }

    return {
      segments: input.segments.map((segment) => ({
        id: segment.id,
        vocabulary: vocabularyById.get(segment.id) ?? [],
      })),
    };
  }
}
