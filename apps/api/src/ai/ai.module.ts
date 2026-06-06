import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { LibraryModule } from "@/library/library.module";
import { AI_PROCESSING_CLIENT } from "./ai-processing-client";
import { AiProcessingService } from "./ai-processing.service";
import { AiProcessingConfigResolver } from "./config/ai-processing-config.resolver";
import { AiProcessingConfigService } from "./config/ai-processing-config.service";
import { AiModelRunStateService } from "./generation/ai-model-run-state.service";
import { AiRequestLogContextService } from "./generation/ai-request-log-context.service";
import { AI_JSON_GENERATION_CLIENT } from "./generation/ai-json-generation-client";
import { GeminiJsonGenerationClient } from "./generation/gemini-json-generation-client";
import { CleanupAiService } from "./processes/cleanup/cleanup-ai.service";
import { SplitAiService } from "./processes/split/split-ai.service";
import { TranslationAiService } from "./processes/translation/translation-ai.service";
import { VocabularyAiService } from "./processes/vocabulary/vocabulary-ai.service";

@Module({
  imports: [AuthModule, LibraryModule],
  providers: [
    AiProcessingConfigResolver,
    AiProcessingConfigService,
    AiProcessingService,
    AiModelRunStateService,
    AiRequestLogContextService,
    CleanupAiService,
    GeminiJsonGenerationClient,
    SplitAiService,
    TranslationAiService,
    VocabularyAiService,
    {
      provide: AI_JSON_GENERATION_CLIENT,
      useExisting: GeminiJsonGenerationClient,
    },
    {
      provide: AI_PROCESSING_CLIENT,
      useExisting: AiProcessingService,
    },
  ],
  exports: [
    AI_PROCESSING_CLIENT,
    AiModelRunStateService,
    AiRequestLogContextService,
    AiProcessingConfigService,
  ],
})
export class AiModule {}
