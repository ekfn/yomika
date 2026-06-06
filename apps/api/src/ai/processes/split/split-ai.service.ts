import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  AI_JSON_GENERATION_CLIENT,
  type AiJsonGenerationClient,
} from "@/ai/generation/ai-json-generation-client";
import type {
  AiSplitInput,
  AiSplitResult,
  AiSplitSegment,
} from "../../ai-processing-client";
import { buildSplitPrompt } from "./split-prompt";

const SPLIT_SEGMENT_LANGUAGE_VALUES = ["en", "ja", "zh", "ru", "el"] as const;

const splitResponseSchema = z.object({
  blocks: z.array(
    z.object({
      id: z.string().min(1),
      segments: z.array(
        z.object({
          text: z.string(),
          languages: z.array(z.enum(SPLIT_SEGMENT_LANGUAGE_VALUES)),
        }),
      ),
    }),
  ),
});

const splitResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blocks"],
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "segments"],
        properties: {
          id: { type: "string" },
          segments: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "languages"],
              properties: {
                text: { type: "string" },
                languages: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: [...SPLIT_SEGMENT_LANGUAGE_VALUES],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class SplitAiService {
  constructor(
    @Inject(AI_JSON_GENERATION_CLIENT)
    private readonly jsonGenerationClient: AiJsonGenerationClient,
  ) {}

  async split(input: AiSplitInput): Promise<AiSplitResult> {
    const parsed = splitResponseSchema.parse(
      await this.jsonGenerationClient.generateJson({
        operation: "split",
        operationName: "split",
        prompt: buildSplitPrompt(input),
        responseJsonSchema: splitResponseJsonSchema,
      }),
    );

    return this.validateSplitResult(input, parsed.blocks);
  }

  private validateSplitResult(
    input: AiSplitInput,
    blocks: Array<{
      id: string;
      segments: Array<{
        text: string;
        languages: Array<(typeof SPLIT_SEGMENT_LANGUAGE_VALUES)[number]>;
      }>;
    }>,
  ): AiSplitResult {
    const expectedIds = new Set(input.cleanupBlocks.map((block) => block.id));
    const seenIds = new Set<string>();
    const segments: AiSplitSegment[] = [];

    for (const block of blocks) {
      if (!expectedIds.has(block.id)) {
        throw new Error(`AI split returned unexpected block id ${block.id}.`);
      }

      if (seenIds.has(block.id)) {
        throw new Error(`AI split returned duplicate block id ${block.id}.`);
      }

      seenIds.add(block.id);

      block.segments.forEach((segment, index) => {
        segments.push({
          id: `${block.id}.${index}`,
          blockId: block.id,
          orderIndex: index,
          text: segment.text,
          languages: segment.languages,
        });
      });
    }

    if (seenIds.size !== expectedIds.size) {
      const missingIds = [...expectedIds].filter((id) => !seenIds.has(id));

      throw new Error(
        `AI split omitted ${missingIds.length} block(s): ${missingIds.join(", ")}.`,
      );
    }

    return { segments };
  }
}
