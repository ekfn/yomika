import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";
import sharp from "sharp";
import { loadAppConfig } from "@/config/app-config";
import { FoldersService } from "@/folders/folders.service";
import {
  getPageDisplayName,
  validatePlainDirectoryName,
} from "@/library/library-directory-names";
import {
  LibraryRepository,
  type PageRecord,
} from "@/library/library.repository";
import type { PageBlockJson, PageJson } from "@/library/library-schemas";
import { RunnerService } from "@/runner/runner.service";
import { UploadStagingService } from "@/uploads/upload-staging.service";

type PageSettingsInput =
  | {
      translationSourceLanguages?: string[] | null;
      translationTargetLanguage?: string | null;
      aiProcessingEnabled?: boolean | null;
      vocabularyEnabled?: boolean | null;
    }
  | null
  | undefined;

type CreatePageInput = {
  name: string;
  parentPath?: string | null;
  sourceUploadId: string;
  settings?: PageSettingsInput;
};

type UpdatePageInput = {
  name?: string | null;
  ocrStatus?: PageJson["ocrStatus"] | null;
  aiProcessingStatus?: PageJson["aiProcessingStatus"] | null;
  settings?: PageSettingsInput;
};

type MovePageInput = {
  targetParentPath?: string | null;
};

type OverwritePageSourceImageInput = {
  sourceUploadId: string;
};

type UpdatePageSegmentTextWithReadingInput = {
  blockId: string;
  segmentId: string;
  textWithReading?: string | null;
};

type UpdatePageSegmentSourceTextInput = {
  blockId: string;
  segmentId: string;
  sourceText: string;
};

type UpdatePageSegmentTranslationInput = {
  blockId: string;
  segmentId: string;
  translation?: string | null;
};

type PageSiblingOutput = {
  path: string;
  pageNumber: number | null;
};

type PageSegmentOutput = {
  id: string;
  orderIndex: number;
  sourceText: string;
  languages: string[];
  translation: string | null;
  textWithReading: string | null;
  vocabulary: PageJson["blocks"][number]["segments"][number]["vocabulary"];
};

type PageBlockOutput = Omit<PageBlockJson, "segments"> & {
  segments: PageSegmentOutput[];
};

type PageEffectiveSettingsOutput = {
  translationSourceLanguages: string[];
  translationTargetLanguage: string;
  aiProcessingEnabled: boolean;
  vocabularyEnabled: boolean;
};

export type PageOutput = {
  path: string;
  bookPath: string | null;
  pageNumber: number | null;
  sourceImageUrl: string;
  sourceImageWidthPx: number;
  sourceImageHeightPx: number;
  sourceImagePreviewUrl: string | null;
  sourceImagePreviewWidthPx: number | null;
  sourceImagePreviewHeightPx: number | null;
  settings: PageJson["settings"];
  effectiveSettings: PageEffectiveSettingsOutput;
  ocrStatus: PageJson["ocrStatus"];
  aiProcessingStatus: PageJson["aiProcessingStatus"];
  ocrRawJson: string | null;
  blocks: PageBlockOutput[];
  previousPage: PageSiblingOutput | null;
  nextPage: PageSiblingOutput | null;
  bookPages: PageSiblingOutput[];
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PagesService {
  private readonly config = loadAppConfig();

  constructor(
    private readonly foldersService: FoldersService,
    private readonly libraryRepository: LibraryRepository,
    private readonly runnerService: RunnerService,
    private readonly uploadStagingService: UploadStagingService,
  ) {}

  async listPages(parentPath?: string | null): Promise<PageOutput[]> {
    if (parentPath !== undefined) {
      await this.foldersService.assertFolderExists(parentPath);

      return Promise.all(
        (
          await this.libraryRepository.listChildStandalonePageRecords(
            parentPath,
          )
        ).map((record) => this.toPageOutput(record)),
      );
    }

    const records = await this.libraryRepository.listAllPageRecords();

    return Promise.all(records.map((record) => this.toPageOutput(record)));
  }

  async getPage(path: string): Promise<PageOutput> {
    return this.toPageOutput(await this.libraryRepository.getPageByPath(path));
  }

  async createPage(input: CreatePageInput): Promise<PageOutput> {
    const uploadMetadata = await this.uploadStagingService.readMetadata(
      input.sourceUploadId,
    );

    if (uploadMetadata.kind !== "PAGE_IMAGE") {
      throw new BadRequestException("The upload is not a page image.");
    }

    const now = new Date().toISOString();
    const parentPath = input.parentPath ?? null;

    await this.foldersService.assertFolderExists(parentPath);

    const pagePath = this.libraryRepository.getStandalonePagePathForCreate(
      parentPath,
      normalizeDirectoryName(input.name),
    );
    const pageDir = await this.libraryRepository.createPageDirectory(pagePath);
    const sourcePath = this.uploadStagingService.getStagedUploadFilePath(
      input.sourceUploadId,
      uploadMetadata.fileName,
    );
    const destinationPath = join(pageDir, uploadMetadata.fileName);
    const previewFileName = "preview.png";
    const previewPath = join(pageDir, previewFileName);
    let didMoveUpload = false;

    try {
      await mkdir(pageDir, { recursive: true });
      await rename(sourcePath, destinationPath);
      didMoveUpload = true;

      const sourceMetadata = await sharp(destinationPath).metadata();

      if (!sourceMetadata.width || !sourceMetadata.height) {
        throw new BadRequestException(
          "Uploaded image dimensions could not be read.",
        );
      }

      const preview = await sharp(destinationPath)
        .resize({
          width: 400,
          height: 600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      await sharp(preview.data).toFile(previewPath);

      const settings = this.mergeSettings(
        this.getDefaultSettings(),
        input.settings,
        {
          allowNullSettings: false,
        },
      );
      requireCompleteSettings(settings);
      const page: PageJson = {
        schemaVersion: 1,
        pageNumber: null,
        sourceImage: {
          fileName: uploadMetadata.fileName,
          mimeType: uploadMetadata.mimeType,
          sizeBytes: uploadMetadata.sizeBytes,
          widthPx: sourceMetadata.width,
          heightPx: sourceMetadata.height,
          previewFileName,
          previewWidthPx: preview.info.width,
          previewHeightPx: preview.info.height,
        },
        settings,
        ocrStatus: "PENDING",
        aiProcessingStatus: "CLEAN_UP_PENDING",
        ocrRawJson: null,
        blocks: [],
        createdAt: now,
        updatedAt: now,
      };

      await this.libraryRepository.writePage(pagePath, page);
      await this.uploadStagingService
        .removeUpload(input.sourceUploadId)
        .catch(() => undefined);

      return this.toPageOutput(
        await this.libraryRepository.getPageByPath(pagePath),
      );
    } catch (error) {
      await rm(pageDir, { recursive: true, force: true }).catch(
        () => undefined,
      );

      if (didMoveUpload) {
        await this.uploadStagingService
          .removeUpload(input.sourceUploadId)
          .catch(() => undefined);
      }

      throw error;
    }
  }

  async updatePage(path: string, input: UpdatePageInput): Promise<PageOutput> {
    const record = await this.libraryRepository.getPageByPath(path);
    let outputRecord = record;

    if (input.name != null) {
      if (record.bookPath) {
        throw new BadRequestException("Book pages cannot be renamed.");
      }

      const nextParentPath = record.parentPath;
      const nextName = normalizeDirectoryName(input.name);

      await this.foldersService.assertFolderExists(nextParentPath);

      const nextPagePath =
        this.libraryRepository.getStandalonePagePathForCreate(
          nextParentPath,
          nextName,
        );

      if (nextPagePath !== record.path) {
        outputRecord = await this.renamePage(record.path, nextPagePath);
      }
    }

    const updatedPage: PageJson = {
      ...record.page,
      ocrStatus: input.ocrStatus ?? record.page.ocrStatus,
      aiProcessingStatus:
        input.aiProcessingStatus ?? record.page.aiProcessingStatus,
      settings: this.mergeSettings(record.page.settings, input.settings, {
        allowNullSettings: Boolean(record.bookPath),
      }),
      updatedAt: new Date().toISOString(),
    };

    await this.libraryRepository.writePage(outputRecord.path, updatedPage);

    return this.toPageOutput(
      await this.libraryRepository.getPageByPath(outputRecord.path),
    );
  }

  async movePage(path: string, input: MovePageInput): Promise<PageOutput> {
    this.assertRunnerIsIdle();

    const record = await this.libraryRepository.getPageByPath(path);

    if (record.bookPath) {
      throw new BadRequestException("Book pages cannot be moved separately.");
    }

    const targetParentPath = input.targetParentPath ?? null;

    await this.foldersService.assertFolderExists(targetParentPath);

    const nextPagePath = this.libraryRepository.getStandalonePagePathForCreate(
      targetParentPath,
      getPageDisplayName(record.path),
    );

    if (nextPagePath === record.path) {
      return this.toPageOutput(record);
    }

    const outputRecord = await this.libraryRepository.movePage(
      record.path,
      nextPagePath,
    );
    const updatedPage: PageJson = {
      ...record.page,
      updatedAt: new Date().toISOString(),
    };

    await this.libraryRepository.writePage(outputRecord.path, updatedPage);

    return this.toPageOutput(
      await this.libraryRepository.getPageByPath(outputRecord.path),
    );
  }

  async overwritePageSourceImage(
    path: string,
    input: OverwritePageSourceImageInput,
  ): Promise<PageOutput> {
    const record = await this.libraryRepository.getPageByPath(path);
    const uploadMetadata = await this.uploadStagingService.readMetadata(
      input.sourceUploadId,
    );

    if (uploadMetadata.kind !== "PAGE_IMAGE") {
      throw new BadRequestException("The upload is not a page image.");
    }

    const sourcePath = this.libraryRepository.getPageSourceImagePath(record);
    const sourceTempPath = join(record.pageDir, ".source.editing.tmp");
    const previewFileName =
      record.page.sourceImage.previewFileName ?? "preview.png";
    const previewPath = join(record.pageDir, previewFileName);
    const previewTempPath = join(record.pageDir, ".preview.editing.tmp");
    const stagedSourcePath = this.uploadStagingService.getStagedUploadFilePath(
      input.sourceUploadId,
      uploadMetadata.fileName,
    );

    try {
      await rm(sourceTempPath, { force: true }).catch(() => undefined);
      await rm(previewTempPath, { force: true }).catch(() => undefined);

      await encodeImageForMimeType(
        sharp(stagedSourcePath),
        record.page.sourceImage.mimeType,
      ).toFile(sourceTempPath);

      const sourceMetadata = await sharp(sourceTempPath).metadata();

      if (!sourceMetadata.width || !sourceMetadata.height) {
        throw new BadRequestException(
          "Edited image dimensions could not be read.",
        );
      }

      const sourceStats = await stat(sourceTempPath);
      const preview = await sharp(sourceTempPath)
        .resize({
          width: 400,
          height: 600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer({ resolveWithObject: true });

      await sharp(preview.data).toFile(previewTempPath);
      await rename(sourceTempPath, sourcePath);
      await rename(previewTempPath, previewPath);

      const now = new Date().toISOString();
      const updatedPage: PageJson = {
        ...record.page,
        sourceImage: {
          ...record.page.sourceImage,
          sizeBytes: sourceStats.size,
          widthPx: sourceMetadata.width,
          heightPx: sourceMetadata.height,
          previewFileName,
          previewWidthPx: preview.info.width,
          previewHeightPx: preview.info.height,
        },
        ocrStatus: "PENDING",
        aiProcessingStatus: "CLEAN_UP_PENDING",
        ocrRawJson: null,
        blocks: [],
        updatedAt: now,
      };

      await this.libraryRepository.writePage(record.path, updatedPage);
      await this.uploadStagingService
        .removeUpload(input.sourceUploadId)
        .catch(() => undefined);
      await this.runnerService.start();

      return this.toPageOutput(
        await this.libraryRepository.getPageByPath(record.path),
      );
    } catch (error) {
      await rm(sourceTempPath, { force: true }).catch(() => undefined);
      await rm(previewTempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async updatePageSegmentTextWithReading(
    path: string,
    input: UpdatePageSegmentTextWithReadingInput,
  ): Promise<PageOutput> {
    const record = await this.libraryRepository.getPageByPath(path);
    const blockIndex = record.page.blocks.findIndex(
      (block) => block.id === input.blockId,
    );

    if (blockIndex < 0) {
      throw new BadRequestException("OCR block was not found.");
    }

    const block = record.page.blocks[blockIndex];

    if (!block) {
      throw new BadRequestException("OCR block was not found.");
    }

    const segmentIndex = block.segments.findIndex(
      (segment) => segment.id === input.segmentId,
    );

    if (segmentIndex < 0) {
      throw new BadRequestException("Segment was not found.");
    }

    const updatedPage: PageJson = {
      ...record.page,
      blocks: record.page.blocks.map((currentBlock, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...currentBlock,
              segments: currentBlock.segments.map(
                (currentSegment, currentSegmentIndex) =>
                  currentSegmentIndex === segmentIndex
                    ? {
                        ...currentSegment,
                        textWithReading: input.textWithReading ?? null,
                      }
                    : currentSegment,
              ),
            }
          : currentBlock,
      ),
      updatedAt: new Date().toISOString(),
    };

    await this.libraryRepository.writePage(record.path, updatedPage);

    return this.toPageOutput(
      await this.libraryRepository.getPageByPath(record.path),
    );
  }

  async updatePageSegmentSourceText(
    path: string,
    input: UpdatePageSegmentSourceTextInput,
  ): Promise<PageOutput> {
    const record = await this.libraryRepository.getPageByPath(path);
    const blockIndex = record.page.blocks.findIndex(
      (block) => block.id === input.blockId,
    );

    if (blockIndex < 0) {
      throw new BadRequestException("OCR block was not found.");
    }

    const block = record.page.blocks[blockIndex];

    if (!block) {
      throw new BadRequestException("OCR block was not found.");
    }

    const segmentIndex = block.segments.findIndex(
      (segment) => segment.id === input.segmentId,
    );

    if (segmentIndex < 0) {
      throw new BadRequestException("Segment was not found.");
    }

    const updatedPage: PageJson = {
      ...record.page,
      blocks: record.page.blocks.map((currentBlock, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...currentBlock,
              segments: currentBlock.segments.map(
                (currentSegment, currentSegmentIndex) =>
                  currentSegmentIndex === segmentIndex
                    ? {
                        ...currentSegment,
                        text: input.sourceText,
                      }
                    : currentSegment,
              ),
            }
          : currentBlock,
      ),
      updatedAt: new Date().toISOString(),
    };

    await this.libraryRepository.writePage(record.path, updatedPage);

    return this.toPageOutput(
      await this.libraryRepository.getPageByPath(record.path),
    );
  }

  async updatePageSegmentTranslation(
    path: string,
    input: UpdatePageSegmentTranslationInput,
  ): Promise<PageOutput> {
    const record = await this.libraryRepository.getPageByPath(path);
    const blockIndex = record.page.blocks.findIndex(
      (block) => block.id === input.blockId,
    );

    if (blockIndex < 0) {
      throw new BadRequestException("OCR block was not found.");
    }

    const block = record.page.blocks[blockIndex];

    if (!block) {
      throw new BadRequestException("OCR block was not found.");
    }

    const segmentIndex = block.segments.findIndex(
      (segment) => segment.id === input.segmentId,
    );

    if (segmentIndex < 0) {
      throw new BadRequestException("Segment was not found.");
    }

    const updatedPage: PageJson = {
      ...record.page,
      blocks: record.page.blocks.map((currentBlock, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...currentBlock,
              segments: currentBlock.segments.map(
                (currentSegment, currentSegmentIndex) =>
                  currentSegmentIndex === segmentIndex
                    ? {
                        ...currentSegment,
                        translation: input.translation ?? null,
                      }
                    : currentSegment,
              ),
            }
          : currentBlock,
      ),
      updatedAt: new Date().toISOString(),
    };

    await this.libraryRepository.writePage(record.path, updatedPage);

    return this.toPageOutput(
      await this.libraryRepository.getPageByPath(record.path),
    );
  }

  async toPageOutput(record: PageRecord): Promise<PageOutput> {
    const bookPages = record.bookPath
      ? await this.libraryRepository.listBookPageRecords(record.bookPath)
      : [];
    const siblingIndex = bookPages.findIndex(
      (bookPage) => bookPage.path === record.path,
    );
    const previousPage = siblingIndex > 0 ? bookPages[siblingIndex - 1] : null;
    const nextPage =
      siblingIndex >= 0 && siblingIndex < bookPages.length - 1
        ? bookPages[siblingIndex + 1]
        : null;
    const effectiveSettings = await this.getEffectiveSettings(record);

    return {
      path: record.path,
      bookPath: record.bookPath,
      pageNumber: record.page.pageNumber,
      sourceImageUrl: this.libraryRepository.getPageSourceImageUrl(record),
      sourceImageWidthPx: record.page.sourceImage.widthPx,
      sourceImageHeightPx: record.page.sourceImage.heightPx,
      sourceImagePreviewUrl:
        this.libraryRepository.getPagePreviewImageUrl(record),
      sourceImagePreviewWidthPx: record.page.sourceImage.previewWidthPx,
      sourceImagePreviewHeightPx: record.page.sourceImage.previewHeightPx,
      settings: record.page.settings,
      effectiveSettings,
      ocrStatus: record.page.ocrStatus,
      aiProcessingStatus: record.page.aiProcessingStatus,
      ocrRawJson:
        record.page.ocrRawJson == null
          ? null
          : JSON.stringify(record.page.ocrRawJson, null, 2),
      blocks: record.page.blocks.map((block) => ({
        ...block,
        segments: block.segments.map((segment) => ({
          id: segment.id,
          orderIndex: segment.orderIndex,
          sourceText: segment.text,
          languages: segment.languages,
          translation: segment.translation,
          textWithReading: segment.textWithReading,
          vocabulary: segment.vocabulary,
        })),
      })),
      previousPage: previousPage ? this.toSiblingOutput(previousPage) : null,
      nextPage: nextPage ? this.toSiblingOutput(nextPage) : null,
      bookPages: bookPages.map((bookPage) => this.toSiblingOutput(bookPage)),
      createdAt: new Date(record.page.createdAt),
      updatedAt: new Date(record.page.updatedAt),
    };
  }

  private getDefaultSettings(): PageJson["settings"] {
    return {
      translationSourceLanguages: this.config.translationSourceLanguages,
      translationTargetLanguage: this.config.translationTargetLanguage,
      aiProcessingEnabled: this.config.aiProcessingEnabled,
      vocabularyEnabled: this.config.vocabularyEnabled,
    };
  }

  private async getEffectiveSettings(
    record: PageRecord,
  ): Promise<PageEffectiveSettingsOutput> {
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
      throw new BadRequestException(
        "Standalone pages must define translation settings.",
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

  private mergeSettings(
    base: PageJson["settings"],
    input: PageSettingsInput,
    options: { allowNullSettings: boolean },
  ): PageJson["settings"] {
    return {
      translationSourceLanguages: normalizeTranslationSourceLanguages(
        base.translationSourceLanguages,
        input,
        options,
      ),
      translationTargetLanguage: normalizeTranslationTargetLanguage(
        base.translationTargetLanguage,
        input,
        options,
      ),
      aiProcessingEnabled: normalizeAiProcessingEnabled(
        base.aiProcessingEnabled,
        input,
        options,
      ),
      vocabularyEnabled: normalizeVocabularyEnabled(
        base.vocabularyEnabled,
        input,
        options,
      ),
    };
  }

  private toSiblingOutput(record: PageRecord): PageSiblingOutput {
    return {
      path: record.path,
      pageNumber: record.page.pageNumber,
    };
  }

  private assertRunnerIsIdle(): void {
    if (this.runnerService.getStatus().state === "RUNNING") {
      throw new BadRequestException(
        "Wait until the runner finishes or stop it before moving library items.",
      );
    }
  }

  private async renamePage(
    path: string,
    nextPath: string,
  ): Promise<PageRecord> {
    if (this.runnerService.getStatus().state === "RUNNING") {
      throw new BadRequestException(
        "Wait until the runner finishes or stop it before renaming library items.",
      );
    }

    return this.libraryRepository.movePage(path, nextPath);
  }
}

function normalizeTranslationSourceLanguages(
  base: PageJson["settings"]["translationSourceLanguages"],
  input: PageSettingsInput,
  options: { allowNullSettings: boolean },
): PageJson["settings"]["translationSourceLanguages"] {
  if (
    !input ||
    !Object.prototype.hasOwnProperty.call(input, "translationSourceLanguages")
  ) {
    return base;
  }

  if (input.translationSourceLanguages === null) {
    if (!options.allowNullSettings) {
      throw new BadRequestException(
        "Only book pages can inherit source language settings.",
      );
    }

    return null;
  }

  return normalizeLanguages(input.translationSourceLanguages) ?? base;
}

function normalizeTranslationTargetLanguage(
  base: PageJson["settings"]["translationTargetLanguage"],
  input: PageSettingsInput,
  options: { allowNullSettings: boolean },
): PageJson["settings"]["translationTargetLanguage"] {
  if (
    !input ||
    !Object.prototype.hasOwnProperty.call(input, "translationTargetLanguage")
  ) {
    return base;
  }

  if (input.translationTargetLanguage === null) {
    if (!options.allowNullSettings) {
      throw new BadRequestException(
        "Only book pages can inherit target language settings.",
      );
    }

    return null;
  }

  return normalizeLanguage(input.translationTargetLanguage) ?? base;
}

function normalizeVocabularyEnabled(
  base: PageJson["settings"]["vocabularyEnabled"],
  input: PageSettingsInput,
  options: { allowNullSettings: boolean },
): PageJson["settings"]["vocabularyEnabled"] {
  if (
    !input ||
    !Object.prototype.hasOwnProperty.call(input, "vocabularyEnabled")
  ) {
    return base;
  }

  if (input.vocabularyEnabled === null) {
    if (!options.allowNullSettings) {
      throw new BadRequestException(
        "Only book pages can inherit vocabulary settings.",
      );
    }

    return null;
  }

  return input.vocabularyEnabled ?? base;
}

function normalizeAiProcessingEnabled(
  base: PageJson["settings"]["aiProcessingEnabled"],
  input: PageSettingsInput,
  options: { allowNullSettings: boolean },
): PageJson["settings"]["aiProcessingEnabled"] {
  if (
    !input ||
    !Object.prototype.hasOwnProperty.call(input, "aiProcessingEnabled")
  ) {
    return base;
  }

  if (input.aiProcessingEnabled === null) {
    if (!options.allowNullSettings) {
      throw new BadRequestException(
        "Only book pages can inherit AI processing settings.",
      );
    }

    return null;
  }

  return input.aiProcessingEnabled ?? base;
}

function requireCompleteSettings(settings: PageJson["settings"]): {
  translationSourceLanguages: string[];
  translationTargetLanguage: string;
  aiProcessingEnabled: boolean;
  vocabularyEnabled: boolean;
} {
  if (settings.translationSourceLanguages === null) {
    throw new BadRequestException(
      "Standalone pages must define source language settings.",
    );
  }

  if (settings.translationTargetLanguage === null) {
    throw new BadRequestException(
      "Standalone pages must define target language settings.",
    );
  }

  if (settings.vocabularyEnabled === null) {
    throw new BadRequestException(
      "Standalone pages must define vocabulary settings.",
    );
  }

  if (settings.aiProcessingEnabled === null) {
    throw new BadRequestException(
      "Standalone pages must define AI processing settings.",
    );
  }

  return {
    translationSourceLanguages: settings.translationSourceLanguages,
    translationTargetLanguage: settings.translationTargetLanguage,
    aiProcessingEnabled: settings.aiProcessingEnabled,
    vocabularyEnabled: settings.vocabularyEnabled,
  };
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

function encodeImageForMimeType(
  image: ReturnType<typeof sharp>,
  mimeType: string,
) {
  if (mimeType === "image/png") {
    return image.png();
  }

  if (mimeType === "image/jpeg") {
    return image.jpeg();
  }

  if (mimeType === "image/webp") {
    return image.webp();
  }

  throw new BadRequestException(
    `Page source image MIME type ${mimeType} is not supported.`,
  );
}

function normalizeDirectoryName(name: string): string {
  const normalizedName = validatePlainDirectoryName(name);

  if (!normalizedName) {
    throw new BadRequestException("Name must be a plain directory name.");
  }

  return normalizedName;
}
