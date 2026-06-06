import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadAppConfig } from "@/config/app-config";
import { FoldersService } from "@/folders/folders.service";
import {
  getBookDisplayName,
  validatePlainDirectoryName,
} from "@/library/library-directory-names";
import {
  LibraryRepository,
  type BookRecord,
} from "@/library/library.repository";
import type { BookJson } from "@/library/library-schemas";
import { PagesService, type PageOutput } from "@/pages/pages.service";
import { UploadStagingService } from "@/uploads/upload-staging.service";

type BookSettingsInput =
  | {
      translationSourceLanguages?: string[] | null;
      translationTargetLanguage?: string | null;
      aiProcessingEnabled?: boolean | null;
      vocabularyEnabled?: boolean | null;
    }
  | null
  | undefined;

type CreateBookInput = {
  name: string;
  parentPath?: string | null;
  sourceUploadId: string;
  settings?: BookSettingsInput;
};

type UpdateBookInput = {
  name?: string | null;
  settings?: BookSettingsInput;
};

export type BookOutput = {
  path: string;
  sourcePdfUrl: string | null;
  sourcePageCount: number | null;
  settings: BookJson["settings"];
  importStatus: BookJson["importStatus"];
  importedPageCount: number;
  pageCount: number;
  firstPage: PageOutput | null;
  pages: PageOutput[];
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BooksService {
  private readonly config = loadAppConfig();

  constructor(
    private readonly foldersService: FoldersService,
    private readonly libraryRepository: LibraryRepository,
    private readonly pagesService: PagesService,
    private readonly uploadStagingService: UploadStagingService,
  ) {}

  async listBooks(parentPath?: string | null): Promise<BookOutput[]> {
    if (parentPath !== undefined) {
      await this.foldersService.assertFolderExists(parentPath);

      return Promise.all(
        (await this.libraryRepository.listChildBookRecords(parentPath)).map(
          (record) => this.toBookOutput(record),
        ),
      );
    }

    return Promise.all(
      (await this.libraryRepository.listBooks()).map((record) =>
        this.toBookOutput(record),
      ),
    );
  }

  async getBook(path: string): Promise<BookOutput> {
    return this.toBookOutput(await this.libraryRepository.getBookByPath(path));
  }

  async createBook(input: CreateBookInput): Promise<BookOutput> {
    const now = new Date().toISOString();
    const name = normalizeDirectoryName(input.name);
    const parentPath = input.parentPath ?? null;

    await this.foldersService.assertFolderExists(parentPath);

    const bookPath = this.libraryRepository.getBookPathForCreate(
      parentPath,
      name,
    );
    const bookDir = await this.libraryRepository.createBookDirectory(bookPath);
    const settings = this.mergeSettings(
      this.getDefaultSettings(),
      input.settings,
    );
    const sourcePdf = await this.consumeSourcePdfUpload(
      bookDir,
      input.sourceUploadId,
    );
    const book: BookJson = {
      schemaVersion: 1,
      sourcePdf,
      settings,
      importStatus: "PENDING",
      importedPageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.libraryRepository.writeBook(bookPath, book);

    return this.toBookOutput(
      await this.libraryRepository.getBookByPath(bookPath),
    );
  }

  async updateBook(path: string, input: UpdateBookInput): Promise<BookOutput> {
    const record = await this.libraryRepository.getBookByPath(path);
    const nextName = normalizeDirectoryName(
      input.name ?? getBookDisplayName(record.path),
    );
    const normalizedNextParentPath = record.parentPath;

    await this.foldersService.assertFolderExists(normalizedNextParentPath);

    const nextBookPath = this.libraryRepository.getBookPathForCreate(
      normalizedNextParentPath,
      nextName,
    );
    const updatedBook: BookJson = {
      ...record.book,
      settings: this.mergeSettings(record.book.settings, input.settings),
      updatedAt: new Date().toISOString(),
    };
    const outputRecord =
      nextBookPath === record.path
        ? record
        : await this.libraryRepository.moveBook(record.path, nextBookPath);

    await this.libraryRepository.writeBook(outputRecord.path, updatedBook);

    return this.toBookOutput(
      await this.libraryRepository.getBookByPath(outputRecord.path),
    );
  }

  async toBookOutput(record: BookRecord): Promise<BookOutput> {
    const pages = await this.libraryRepository.listBookPageRecords(record.path);
    const pageOutputs = await Promise.all(
      pages.map((page) => this.pagesService.toPageOutput(page)),
    );

    return {
      path: record.path,
      sourcePdfUrl: this.libraryRepository.getBookSourcePdfUrl(record),
      sourcePageCount: record.book.sourcePdf?.pageCount ?? null,
      settings: record.book.settings,
      importStatus: record.book.importStatus,
      importedPageCount: record.book.importedPageCount,
      pageCount: pageOutputs.length,
      firstPage: pageOutputs[0] ?? null,
      pages: pageOutputs,
      createdAt: new Date(record.book.createdAt),
      updatedAt: new Date(record.book.updatedAt),
    };
  }

  private async consumeSourcePdfUpload(
    bookDir: string,
    uploadId: string,
  ): Promise<BookJson["sourcePdf"]> {
    const uploadMetadata =
      await this.uploadStagingService.readMetadata(uploadId);

    if (uploadMetadata.kind !== "BOOK_PDF") {
      throw new BadRequestException("The upload is not a book PDF.");
    }

    const sourcePath = this.uploadStagingService.getStagedUploadFilePath(
      uploadId,
      uploadMetadata.fileName,
    );
    const destinationDir = join(bookDir, "source");
    const destinationPath = join(destinationDir, "source.pdf");
    let didMoveUpload = false;

    try {
      await mkdir(destinationDir, { recursive: true });
      await rename(sourcePath, destinationPath);
      didMoveUpload = true;

      const pageCount = await this.getPdfPageCount(destinationPath);

      await this.uploadStagingService
        .removeUpload(uploadId)
        .catch(() => undefined);

      return {
        fileName: "source.pdf",
        mimeType: "application/pdf",
        sizeBytes: uploadMetadata.sizeBytes,
        pageCount,
      };
    } catch (error) {
      if (didMoveUpload) {
        await rm(destinationDir, { recursive: true, force: true }).catch(
          () => undefined,
        );
        await this.uploadStagingService
          .removeUpload(uploadId)
          .catch(() => undefined);
      }

      throw error;
    }
  }

  private async getPdfPageCount(sourceFilePath: string): Promise<number> {
    try {
      const sourceFileBuffer = await readFile(sourceFilePath);
      const loadingTask = getDocument({
        data: new Uint8Array(sourceFileBuffer),
        disableFontFace: true,
        useSystemFonts: true,
        enableXfa: false,
      });
      const pdfDocument = await loadingTask.promise;

      try {
        if (pdfDocument.numPages <= 0) {
          throw new BadRequestException("Uploaded PDF file contains no pages.");
        }

        return pdfDocument.numPages;
      } finally {
        await pdfDocument.destroy();
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException("Uploaded PDF file could not be read.");
    }
  }

  private getDefaultSettings(): BookJson["settings"] {
    return {
      translationSourceLanguages: this.config.translationSourceLanguages,
      translationTargetLanguage: this.config.translationTargetLanguage,
      aiProcessingEnabled: this.config.aiProcessingEnabled,
      vocabularyEnabled: this.config.vocabularyEnabled,
    };
  }

  private mergeSettings(
    base: BookJson["settings"],
    input: BookSettingsInput,
  ): BookJson["settings"] {
    return {
      translationSourceLanguages:
        normalizeLanguages(input?.translationSourceLanguages) ??
        base.translationSourceLanguages,
      translationTargetLanguage:
        normalizeLanguage(input?.translationTargetLanguage) ??
        base.translationTargetLanguage,
      aiProcessingEnabled:
        input?.aiProcessingEnabled ?? base.aiProcessingEnabled,
      vocabularyEnabled: input?.vocabularyEnabled ?? base.vocabularyEnabled,
    };
  }
}

function normalizeLanguages(value: string[] | null | undefined) {
  if (value == null) {
    return undefined;
  }

  const normalizedLanguages = value
    .map((language) => language.trim())
    .filter(Boolean);

  if (normalizedLanguages.length === 0) {
    throw new BadRequestException(
      "At least one translation source language is required.",
    );
  }

  return normalizedLanguages;
}

function normalizeLanguage(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }

  const normalizedLanguage = value.trim();

  if (!normalizedLanguage) {
    throw new BadRequestException("Translation target language is required.");
  }

  return normalizedLanguage;
}

function normalizeDirectoryName(name: string): string {
  const normalizedName = validatePlainDirectoryName(name);

  if (!normalizedName) {
    throw new BadRequestException("Name must be a plain directory name.");
  }

  return normalizedName;
}
