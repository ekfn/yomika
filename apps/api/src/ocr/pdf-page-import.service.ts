import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import {
  LibraryRepository,
  type BookRecord,
} from "@/library/library.repository";
import type { PageJson } from "@/library/library-schemas";
import { pdfToPng } from "pdf-to-png-converter";
import sharp from "sharp";
import { ImagePreviewService } from "./image-preview.service";

type RenderedPdfPage = {
  pageNumber: number;
  pngBuffer: Buffer;
  widthPx: number;
  heightPx: number;
};

@Injectable()
export class PdfPageImportService {
  constructor(
    private readonly imagePreviewService: ImagePreviewService,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  async importBookPages(bookPath: string): Promise<void> {
    const bookRecord = await this.libraryRepository.getBookByPath(bookPath);
    const book = bookRecord.book;

    if (!book.sourcePdf) {
      return;
    }

    await this.libraryRepository.writeBook(bookRecord.path, {
      ...book,
      importStatus: "IMPORTING",
      updatedAt: new Date().toISOString(),
    });

    try {
      const sourceFilePath =
        this.libraryRepository.getBookSourcePdfPath(bookRecord);

      if (!sourceFilePath) {
        return;
      }

      const existingPageNumbers = new Set(
        (await this.libraryRepository.listBookPageRecords(bookRecord.path))
          .map((record) => record.page.pageNumber)
          .filter((pageNumber): pageNumber is number => pageNumber !== null),
      );

      for (
        let pageNumber = 1;
        pageNumber <= book.sourcePdf.pageCount;
        pageNumber += 1
      ) {
        if (existingPageNumbers.has(pageNumber)) {
          continue;
        }

        await this.importBookPage(bookRecord, sourceFilePath, pageNumber);
        existingPageNumbers.add(pageNumber);
      }

      await this.libraryRepository.writeBook(bookRecord.path, {
        ...book,
        importStatus: "COMPLETE",
        importedPageCount: existingPageNumbers.size,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.libraryRepository.writeBook(bookRecord.path, {
        ...book,
        importStatus: "PENDING",
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  private async importBookPage(
    bookRecord: BookRecord,
    sourceFilePath: string,
    pageNumber: number,
  ): Promise<void> {
    const renderedPage = await this.renderPdfToPngPage(
      sourceFilePath,
      pageNumber,
    );
    const preview = await this.imagePreviewService.createPngPreview(
      renderedPage.pngBuffer,
    );
    const now = new Date().toISOString();
    const pagePath = this.libraryRepository.getBookPagePathForCreate(
      bookRecord.path,
      pageNumber,
    );
    const pageDir = await this.libraryRepository.createPageDirectory(pagePath);
    const sourceFileName = "source.png";
    const previewFileName = "preview.png";

    await mkdir(pageDir, { recursive: true });
    await writeFile(join(pageDir, sourceFileName), renderedPage.pngBuffer);
    await writeFile(join(pageDir, previewFileName), preview.buffer);

    const page: PageJson = {
      schemaVersion: 1,
      pageNumber,
      sourceImage: {
        fileName: sourceFileName,
        mimeType: "image/png",
        sizeBytes: renderedPage.pngBuffer.length,
        widthPx: renderedPage.widthPx,
        heightPx: renderedPage.heightPx,
        previewFileName,
        previewWidthPx: preview.widthPx,
        previewHeightPx: preview.heightPx,
      },
      settings: {
        ...bookRecord.book.settings,
        translationSourceLanguages: null,
        translationTargetLanguage: null,
        aiProcessingEnabled: null,
        vocabularyEnabled: null,
      },
      ocrStatus: "PENDING",
      aiProcessingStatus: "CLEAN_UP_PENDING",
      ocrRawJson: null,
      blocks: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.libraryRepository.writePage(pagePath, page);
  }

  private async renderPdfToPngPage(
    sourceFilePath: string,
    pageNumber: number,
  ): Promise<RenderedPdfPage> {
    const renderedPages = await pdfToPng(sourceFilePath, {
      disableFontFace: true,
      useSystemFonts: true,
      enableXfa: false,
      pagesToProcess: [pageNumber],
      viewportScale: 3.0,
      verbosityLevel: 0,
    });
    const renderedPage = renderedPages[0];

    if (renderedPages.length !== 1 || !renderedPage?.content) {
      throw new Error(`The PDF renderer returned invalid page ${pageNumber}.`);
    }

    if (renderedPage.pageNumber !== pageNumber) {
      throw new Error(
        `The PDF renderer returned page ${renderedPage.pageNumber} while page ${pageNumber} was requested.`,
      );
    }

    const metadata = await sharp(renderedPage.content).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error(
        `The rendered PNG dimensions could not be read for page ${pageNumber}.`,
      );
    }

    return {
      pageNumber: renderedPage.pageNumber,
      pngBuffer: renderedPage.content,
      widthPx: metadata.width,
      heightPx: metadata.height,
    };
  }
}
