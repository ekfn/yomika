import { Injectable } from "@nestjs/common";
import type {
  AiCleanupInput,
  AiCleanupResult,
  AiProcessingClient,
  AiSplitInput,
  AiSplitResult,
  AiTranslateInput,
  AiTranslateResult,
  AiVocabularyInput,
  AiVocabularyResult,
} from "./ai-processing-client";
import { CleanupAiService } from "./processes/cleanup/cleanup-ai.service";
import { SplitAiService } from "./processes/split/split-ai.service";
import { TranslationAiService } from "./processes/translation/translation-ai.service";
import { VocabularyAiService } from "./processes/vocabulary/vocabulary-ai.service";

@Injectable()
export class AiProcessingService implements AiProcessingClient {
  constructor(
    private readonly cleanupAiService: CleanupAiService,
    private readonly splitAiService: SplitAiService,
    private readonly translationAiService: TranslationAiService,
    private readonly vocabularyAiService: VocabularyAiService,
  ) {}

  cleanup(input: AiCleanupInput): Promise<AiCleanupResult> {
    return this.cleanupAiService.cleanup(input);
  }

  split(input: AiSplitInput): Promise<AiSplitResult> {
    return this.splitAiService.split(input);
  }

  translate(input: AiTranslateInput): Promise<AiTranslateResult> {
    return this.translationAiService.translate(input);
  }

  extractVocabulary(input: AiVocabularyInput): Promise<AiVocabularyResult> {
    return this.vocabularyAiService.extractVocabulary(input);
  }
}
