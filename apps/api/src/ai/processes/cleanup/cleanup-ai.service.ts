import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  AI_JSON_GENERATION_CLIENT,
  type AiJsonGenerationClient,
} from "@/ai/generation/ai-json-generation-client";
import type {
  AiCleanupInput,
  AiCleanupResult,
} from "../../ai-processing-client";
import { buildCleanupPrompt } from "./cleanup-prompt";

const cleanupResponseSchema = z.object({
  blocks: z.array(
    z.object({
      id: z.string().min(1),
      content: z.string(),
    }),
  ),
});

const cleanupResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blocks"],
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "content"],
        properties: {
          id: { type: "string" },
          content: { type: "string" },
        },
      },
    },
  },
};

@Injectable()
export class CleanupAiService {
  constructor(
    @Inject(AI_JSON_GENERATION_CLIENT)
    private readonly jsonGenerationClient: AiJsonGenerationClient,
  ) {}

  async cleanup(input: AiCleanupInput): Promise<AiCleanupResult> {
    const parsed = cleanupResponseSchema.parse(
      await this.jsonGenerationClient.generateJson({
        operation: "cleanup",
        operationName: "cleanup",
        prompt: buildCleanupPrompt(input),
        responseJsonSchema: cleanupResponseJsonSchema,
      }),
    );
    const contentByBlockId = this.validateCleanupResult(input, parsed.blocks);

    return {
      blocks: input.ocrBlocks.map((block) => ({
        ...block,
        content: contentByBlockId.get(block.id) ?? block.content,
      })),
    };
  }

  private validateCleanupResult(
    input: AiCleanupInput,
    blocks: Array<{ id: string; content: string }>,
  ): Map<string, string> {
    const expectedIds = new Set(input.ocrBlocks.map((block) => block.id));
    const contentByBlockId = new Map<string, string>();

    for (const block of blocks) {
      if (!expectedIds.has(block.id)) {
        throw new Error(`AI cleanup returned unexpected block id ${block.id}.`);
      }

      if (contentByBlockId.has(block.id)) {
        throw new Error(`AI cleanup returned duplicate block id ${block.id}.`);
      }

      contentByBlockId.set(block.id, block.content);
    }

    if (contentByBlockId.size !== expectedIds.size) {
      const missingIds = [...expectedIds].filter(
        (id) => !contentByBlockId.has(id),
      );

      throw new Error(
        `AI cleanup omitted ${missingIds.length} block(s): ${missingIds.join(", ")}.`,
      );
    }

    return contentByBlockId;
  }
}
