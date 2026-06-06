import { Inject, Injectable } from "@nestjs/common";
import {
  AI_PROCESSING_CLIENT,
  type AiProcessingClient,
} from "@/ai/ai-processing-client";
import { normalizeOcrBlocks } from "@/ocr/ocr-normalization";
import { CleanupContextService } from "@/page-processing/cleanup-context.service";
import {
  isEditableCleanupOcrBlock,
  normalizeCleanupOcrBlockContent,
  toPageBlockWithoutSegments,
} from "@/page-processing/page-block-transforms";
import type { RunnerTaskHandler } from "../runner-task-handler";
import { RunnerTaskStateService } from "../runner-task-state.service";
import type { RunnerTask } from "../runner-types";

@Injectable()
export class CleanupTaskHandler implements RunnerTaskHandler {
  constructor(
    @Inject(AI_PROCESSING_CLIENT)
    private readonly aiProcessingClient: AiProcessingClient,
    private readonly cleanupContext: CleanupContextService,
    private readonly runnerTaskState: RunnerTaskStateService,
  ) {}

  async run(task: RunnerTask): Promise<void> {
    const pageRecord = await this.runnerTaskState.getTaskPage(task);
    const processingPageRecord = await this.runnerTaskState.writePage(
      pageRecord,
      {
        ...pageRecord.page,
        aiProcessingStatus: "CLEAN_UP_PROCESSING",
      },
    );
    const ocrBlocks = normalizeOcrBlocks(
      processingPageRecord.page.ocrRawJson,
      processingPageRecord.page.sourceImage.widthPx,
      processingPageRecord.page.sourceImage.heightPx,
    );
    const editableOcrBlocks = ocrBlocks.filter(isEditableCleanupOcrBlock);
    const effectiveSettings =
      await this.runnerTaskState.getEffectivePageSettings(processingPageRecord);
    const result =
      editableOcrBlocks.length === 0
        ? { blocks: [] }
        : await this.aiProcessingClient.cleanup({
            pagePath: processingPageRecord.path,
            sourceLanguages: effectiveSettings.translationSourceLanguages,
            targetLanguage: effectiveSettings.translationTargetLanguage,
            context:
              await this.cleanupContext.getCleanupContext(processingPageRecord),
            ocrBlocks: editableOcrBlocks,
          });
    const cleanedContentByBlockId = new Map(
      result.blocks.map((block) => [
        block.id,
        normalizeCleanupOcrBlockContent(block.content),
      ]),
    );

    await this.runnerTaskState.writePage(processingPageRecord, {
      ...processingPageRecord.page,
      aiProcessingStatus: "SPLIT_PENDING",
      blocks: ocrBlocks
        .map((block) => ({
          ...block,
          content: cleanedContentByBlockId.get(block.id) ?? block.content,
        }))
        .map(toPageBlockWithoutSegments),
    });
  }
}
