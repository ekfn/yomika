import { Module } from "@nestjs/common";
import { AiModule } from "@/ai/ai.module";
import { AuthModule } from "@/auth/auth.module";
import { LibraryModule } from "@/library/library.module";
import { OcrModule } from "@/ocr/ocr.module";
import { CleanupContextService } from "@/page-processing/cleanup-context.service";
import { BookImportTaskHandler } from "./handlers/book-import-task.handler";
import { CleanupTaskHandler } from "./handlers/cleanup-task.handler";
import { OcrTaskHandler } from "./handlers/ocr-task.handler";
import { SplitTaskHandler } from "./handlers/split-task.handler";
import { TranslationTaskHandler } from "./handlers/translation-task.handler";
import { VocabularyTaskHandler } from "./handlers/vocabulary-task.handler";
import { RunnerResolver } from "./runner.resolver";
import { RunnerOperationLogService } from "./runner-operation-log.service";
import { RunnerService } from "./runner.service";
import { RunnerStateService } from "./runner-state.service";
import { RunnerTaskFinderService } from "./runner-task-finder.service";
import { RunnerTaskStateService } from "./runner-task-state.service";

@Module({
  imports: [AiModule, AuthModule, LibraryModule, OcrModule],
  providers: [
    BookImportTaskHandler,
    CleanupContextService,
    CleanupTaskHandler,
    OcrTaskHandler,
    RunnerOperationLogService,
    RunnerResolver,
    RunnerService,
    RunnerStateService,
    RunnerTaskFinderService,
    RunnerTaskStateService,
    SplitTaskHandler,
    TranslationTaskHandler,
    VocabularyTaskHandler,
  ],
  exports: [RunnerService, RunnerStateService],
})
export class RunnerModule {}
