import { Inject, Injectable } from "@nestjs/common";
import {
  AI_PROCESSING_CLIENT,
  type AiProcessingClient,
} from "@/ai/ai-processing-client";
import {
  applyTranslationsToBlocks,
  toAiTranslationInputSegments,
} from "@/page-processing/page-block-transforms";
import type { RunnerTaskHandler } from "../runner-task-handler";
import { RunnerTaskStateService } from "../runner-task-state.service";
import type { RunnerTask } from "../runner-types";

@Injectable()
export class TranslationTaskHandler implements RunnerTaskHandler {
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
        aiProcessingStatus: "TRANSLATING",
      },
    );
    const effectiveSettings =
      await this.runnerTaskState.getEffectivePageSettings(processingPageRecord);
    const translationSegments = toAiTranslationInputSegments(
      processingPageRecord.page.blocks,
      effectiveSettings.translationSourceLanguages,
    );
    const result =
      translationSegments.length === 0
        ? { segments: [] }
        : await this.aiProcessingClient.translate({
            context: {
              pagePath: processingPageRecord.path,
              sourceLanguages: effectiveSettings.translationSourceLanguages,
              targetLanguage: effectiveSettings.translationTargetLanguage,
            },
            segments: translationSegments,
          });

    await this.runnerTaskState.writePage(processingPageRecord, {
      ...processingPageRecord.page,
      aiProcessingStatus: "VOCABULARY_PENDING",
      blocks: applyTranslationsToBlocks(
        processingPageRecord.page.blocks,
        result.segments,
      ),
    });
  }
}
