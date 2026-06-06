import { Inject, Injectable } from "@nestjs/common";
import {
  AI_PROCESSING_CLIENT,
  type AiProcessingClient,
} from "@/ai/ai-processing-client";
import {
  applySplitSegmentsToBlocks,
  isEditableCleanupOcrBlock,
} from "@/page-processing/page-block-transforms";
import type { RunnerTaskHandler } from "../runner-task-handler";
import { RunnerTaskStateService } from "../runner-task-state.service";
import type { RunnerTask } from "../runner-types";

@Injectable()
export class SplitTaskHandler implements RunnerTaskHandler {
  constructor(
    @Inject(AI_PROCESSING_CLIENT)
    private readonly aiProcessingClient: AiProcessingClient,
    private readonly runnerTaskState: RunnerTaskStateService,
  ) {}

  async run(task: RunnerTask): Promise<void> {
    const pageRecord = await this.runnerTaskState.getTaskPage(task);
    const processingPageRecord = await this.runnerTaskState.writePage(
      pageRecord,
      {
        ...pageRecord.page,
        aiProcessingStatus: "SPLITTING",
      },
    );
    const cleanupBlocks = processingPageRecord.page.blocks.filter(
      isEditableCleanupOcrBlock,
    );
    const effectiveSettings =
      await this.runnerTaskState.getEffectivePageSettings(processingPageRecord);
    const result =
      cleanupBlocks.length === 0
        ? { segments: [] }
        : await this.aiProcessingClient.split({
            pagePath: processingPageRecord.path,
            sourceLanguages: effectiveSettings.translationSourceLanguages,
            targetLanguage: effectiveSettings.translationTargetLanguage,
            cleanupBlocks,
          });

    await this.runnerTaskState.writePage(processingPageRecord, {
      ...processingPageRecord.page,
      aiProcessingStatus: "TRANSLATION_PENDING",
      blocks: applySplitSegmentsToBlocks(
        processingPageRecord.page.blocks,
        result.segments,
      ),
    });
  }
}
