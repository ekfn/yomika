import { Injectable } from "@nestjs/common";
import {
  LibraryRepository,
  type PageRecord,
} from "@/library/library.repository";
import type { PageJson } from "@/library/library-schemas";
import type { RunnerTask } from "./runner-types";

export type EffectivePageSettings = {
  translationSourceLanguages: string[];
  translationTargetLanguage: string;
  aiProcessingEnabled: boolean;
  vocabularyEnabled: boolean;
};

@Injectable()
export class RunnerTaskStateService {
  constructor(private readonly libraryRepository: LibraryRepository) {}

  async getTaskPage(task: RunnerTask): Promise<PageRecord> {
    if (!task.pagePath) {
      throw new Error(`${task.type} task is missing a page path.`);
    }

    return this.libraryRepository.getPageByPath(task.pagePath);
  }

  async writePage(record: PageRecord, page: PageJson): Promise<PageRecord> {
    const updatedPage: PageJson = {
      ...page,
      updatedAt: new Date().toISOString(),
    };

    await this.libraryRepository.writePage(record.path, updatedPage);

    return this.libraryRepository.getPageByPath(record.path);
  }

  async getEffectivePageSettings(
    record: PageRecord,
  ): Promise<EffectivePageSettings> {
    const settings = record.page.settings;

    if (
      settings.translationSourceLanguages !== null &&
      settings.translationTargetLanguage !== null &&
      settings.aiProcessingEnabled !== null &&
      settings.vocabularyEnabled !== null
    ) {
      return {
        translationSourceLanguages: settings.translationSourceLanguages,
        translationTargetLanguage: settings.translationTargetLanguage,
        aiProcessingEnabled: settings.aiProcessingEnabled,
        vocabularyEnabled: settings.vocabularyEnabled,
      };
    }

    if (!record.bookPath) {
      throw new Error(
        `Standalone page ${record.path} has incomplete translation settings.`,
      );
    }

    const bookRecord = await this.libraryRepository.getBookByPath(
      record.bookPath,
    );
    const bookSettings = bookRecord.book.settings;

    return {
      translationSourceLanguages:
        settings.translationSourceLanguages ??
        bookSettings.translationSourceLanguages,
      translationTargetLanguage:
        settings.translationTargetLanguage ??
        bookSettings.translationTargetLanguage,
      aiProcessingEnabled:
        settings.aiProcessingEnabled ?? bookSettings.aiProcessingEnabled,
      vocabularyEnabled:
        settings.vocabularyEnabled ?? bookSettings.vocabularyEnabled,
    };
  }

  async returnTaskToPending(task: RunnerTask | null): Promise<void> {
    if (!task) {
      return;
    }

    if (task.type === "BOOK_IMPORT") {
      if (!task.bookPath) {
        return;
      }

      const book = await this.libraryRepository.getBookByPath(task.bookPath);
      await this.libraryRepository.writeBook(book.path, {
        ...book.book,
        importStatus: "PENDING",
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (!task.pagePath) {
      return;
    }

    const pageRecord = await this.libraryRepository.getPageByPath(
      task.pagePath,
    );

    await this.libraryRepository.writePage(pageRecord.path, {
      ...pageRecord.page,
      ...(task.type === "OCR"
        ? { ocrStatus: "PENDING" as const }
        : { aiProcessingStatus: this.getPendingAiProcessingStatus(task.type) }),
      updatedAt: new Date().toISOString(),
    });
  }

  private getPendingAiProcessingStatus(
    taskType: RunnerTask["type"],
  ): PageJson["aiProcessingStatus"] {
    switch (taskType) {
      case "CLEAN_UP":
        return "CLEAN_UP_PENDING";
      case "SPLIT":
        return "SPLIT_PENDING";
      case "TRANSLATION":
        return "TRANSLATION_PENDING";
      case "VOCABULARY":
        return "VOCABULARY_PENDING";
      case "BOOK_IMPORT":
      case "OCR":
        throw new Error(`${taskType} does not map to an AI processing status.`);
    }
  }
}
