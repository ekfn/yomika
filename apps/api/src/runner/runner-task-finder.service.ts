import { Injectable } from "@nestjs/common";
import { AiProcessingConfigService } from "@/ai/config/ai-processing-config.service";
import type { AiProcessingOperation } from "@/ai/config/ai-processing-config-schemas";
import { AiModelRunStateService } from "@/ai/generation/ai-model-run-state.service";
import {
  getBookDisplayName,
  getPageDisplayName,
} from "@/library/library-directory-names";
import {
  LibraryRepository,
  type BookRecord,
  type PageRecord,
} from "@/library/library.repository";
import { sortBy } from "remeda";
import { RunnerTaskStateService } from "./runner-task-state.service";
import type { RunnerTask } from "./runner-types";

type AiProcessingTaskType = Extract<
  RunnerTask["type"],
  "CLEAN_UP" | "SPLIT" | "TRANSLATION" | "VOCABULARY"
>;

type AiProcessingTaskConfig = {
  type: AiProcessingTaskType;
  labelPrefix: string;
};

const AI_PROCESSING_TASKS_BY_STATUS: Partial<
  Record<PageRecord["page"]["aiProcessingStatus"], AiProcessingTaskConfig>
> = {
  CLEAN_UP_PENDING: {
    type: "CLEAN_UP",
    labelPrefix: "Clean up OCR text",
  },
  SPLIT_PENDING: {
    type: "SPLIT",
    labelPrefix: "Split text",
  },
  TRANSLATION_PENDING: {
    type: "TRANSLATION",
    labelPrefix: "Translate text",
  },
  VOCABULARY_PENDING: {
    type: "VOCABULARY",
    labelPrefix: "Extract vocabulary",
  },
};

const AI_PROCESSING_OPERATION_BY_TASK_TYPE = {
  CLEAN_UP: "cleanup",
  SPLIT: "split",
  TRANSLATION: "translation",
  VOCABULARY: "vocabulary",
} satisfies Record<AiProcessingTaskType, AiProcessingOperation>;

@Injectable()
export class RunnerTaskFinderService {
  constructor(
    private readonly aiModelRunState: AiModelRunStateService,
    private readonly aiProcessingConfigService: AiProcessingConfigService,
    private readonly libraryRepository: LibraryRepository,
    private readonly runnerTaskState: RunnerTaskStateService,
  ) {}

  async buildTaskQueue(): Promise<RunnerTask[]> {
    const books = sortBookRecordsForQueue(
      await this.libraryRepository.listBooks(),
    );
    const importTasks = this.buildBookImportTasks(books);

    if (importTasks.length > 0) {
      return importTasks;
    }

    const pages = sortPageRecordsForQueue(
      await this.libraryRepository.listAllPageRecords(),
    );
    const ocrTasks = this.buildOcrTasks(pages);

    if (ocrTasks.length > 0) {
      return ocrTasks;
    }

    return this.buildAiProcessingTasks(pages);
  }

  async findNextAiProcessingTaskForPage(
    pagePath: string,
  ): Promise<RunnerTask | null> {
    return this.buildAiProcessingTask(
      await this.libraryRepository.getPageByPath(pagePath),
      new Map(),
    );
  }

  private buildBookImportTasks(bookRecords: BookRecord[]): RunnerTask[] {
    return bookRecords
      .filter((record) => record.book.importStatus === "PENDING")
      .map((record) => ({
        type: "BOOK_IMPORT",
        bookPath: record.path,
        pagePath: null,
        label: `Import pages for ${getBookDisplayName(record.path)}`,
      }));
  }

  private buildOcrTasks(pageRecords: PageRecord[]): RunnerTask[] {
    return pageRecords
      .filter((record) => record.page.ocrStatus === "PENDING")
      .map((record) => ({
        type: "OCR",
        bookPath: record.bookPath,
        pagePath: record.path,
        label: `Run OCR for ${getPageDisplayName(record.path)}`,
      }));
  }

  private async buildAiProcessingTasks(
    pageRecords: PageRecord[],
  ): Promise<RunnerTask[]> {
    const tasks: RunnerTask[] = [];
    const taskAvailability = new Map<AiProcessingTaskType, boolean>();

    for (const pageRecord of pageRecords) {
      const task = await this.buildAiProcessingTask(
        pageRecord,
        taskAvailability,
      );

      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  private async buildAiProcessingTask(
    pageRecord: PageRecord,
    taskAvailability: Map<AiProcessingTaskType, boolean>,
  ): Promise<RunnerTask | null> {
    if (pageRecord.page.ocrStatus !== "COMPLETE") {
      return null;
    }

    const taskConfig =
      AI_PROCESSING_TASKS_BY_STATUS[pageRecord.page.aiProcessingStatus];

    if (!taskConfig) {
      return null;
    }

    const settings =
      await this.runnerTaskState.getEffectivePageSettings(pageRecord);

    if (!settings.aiProcessingEnabled) {
      return null;
    }

    if (taskConfig.type === "VOCABULARY" && !settings.vocabularyEnabled) {
      return null;
    }

    const hasAvailableModels = await this.hasAvailableModelsForTask(
      taskConfig.type,
      taskAvailability,
    );

    if (!hasAvailableModels) {
      return null;
    }

    return {
      type: taskConfig.type,
      bookPath: pageRecord.bookPath,
      pagePath: pageRecord.path,
      label: `${taskConfig.labelPrefix} for ${getPageDisplayName(pageRecord.path)}`,
    };
  }

  private async hasAvailableModelsForTask(
    taskType: AiProcessingTaskType,
    taskAvailability: Map<AiProcessingTaskType, boolean>,
  ): Promise<boolean> {
    const cachedAvailability = taskAvailability.get(taskType);

    if (cachedAvailability !== undefined) {
      return cachedAvailability;
    }

    const modelConfigs =
      await this.aiProcessingConfigService.getGenerationModelConfigs(
        AI_PROCESSING_OPERATION_BY_TASK_TYPE[taskType],
      );
    const hasAvailableModels = this.aiModelRunState.hasAvailableModel(
      modelConfigs.map((modelConfig) => modelConfig.modelId),
    );

    taskAvailability.set(taskType, hasAvailableModels);

    return hasAvailableModels;
  }
}

function sortBookRecordsForQueue(records: BookRecord[]): BookRecord[] {
  return sortBy(
    records,
    (record) => record.book.createdAt,
    (record) => record.path,
  );
}

function sortPageRecordsForQueue(records: PageRecord[]): PageRecord[] {
  return sortBy(
    records,
    (record) => record.page.createdAt,
    (record) => record.path,
  );
}
