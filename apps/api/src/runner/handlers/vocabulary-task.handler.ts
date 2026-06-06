import { Inject, Injectable } from "@nestjs/common";
import {
  AI_PROCESSING_CLIENT,
  type AiProcessingClient,
} from "@/ai/ai-processing-client";
import {
  applyVocabularyToBlocks,
  toAiVocabularyInputSegments,
} from "@/page-processing/page-block-transforms";
import type { RunnerTaskHandler } from "../runner-task-handler";
import { RunnerTaskStateService } from "../runner-task-state.service";
import type { RunnerTask } from "../runner-types";

@Injectable()
export class VocabularyTaskHandler implements RunnerTaskHandler {
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
        aiProcessingStatus: "VOCABULARY_PROCESSING",
      },
    );
    const effectiveSettings =
      await this.runnerTaskState.getEffectivePageSettings(processingPageRecord);
    const segments = toAiVocabularyInputSegments(
      processingPageRecord.page.blocks,
      effectiveSettings.translationSourceLanguages,
    );
    const result =
      segments.length === 0
        ? { segments: [] }
        : await this.aiProcessingClient.extractVocabulary({
            pagePath: processingPageRecord.path,
            sourceLanguages: effectiveSettings.translationSourceLanguages,
            targetLanguage: effectiveSettings.translationTargetLanguage,
            segments,
          });

    await this.runnerTaskState.writePage(processingPageRecord, {
      ...processingPageRecord.page,
      aiProcessingStatus: "COMPLETE",
      blocks: applyVocabularyToBlocks(
        processingPageRecord.page.blocks,
        result.segments,
      ),
    });
  }
}
