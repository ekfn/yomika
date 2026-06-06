import { Injectable } from "@nestjs/common";
import type { AiCleanupContextBlock } from "@/ai/ai-processing-client";
import {
  LibraryRepository,
  type PageRecord,
} from "@/library/library.repository";
import type { OcrBlockJson } from "@/library/library-schemas";
import { normalizeOcrBlocks } from "@/ocr/ocr-normalization";

const CLEANUP_CONTEXT_BLOCK_COUNT = 5;

@Injectable()
export class CleanupContextService {
  constructor(private readonly libraryRepository: LibraryRepository) {}

  async getCleanupContext(record: PageRecord): Promise<{
    previousPage: AiCleanupContextBlock[];
    nextPage: AiCleanupContextBlock[];
  }> {
    if (!record.bookPath) {
      return {
        previousPage: [],
        nextPage: [],
      };
    }

    const bookPages = await this.libraryRepository.listBookPageRecords(
      record.bookPath,
    );
    const pageIndex = bookPages.findIndex(
      (bookPage) => bookPage.path === record.path,
    );
    const previousPage =
      pageIndex > 0 ? (bookPages[pageIndex - 1] ?? null) : null;
    const nextPage =
      pageIndex >= 0 && pageIndex < bookPages.length - 1
        ? (bookPages[pageIndex + 1] ?? null)
        : null;

    return {
      previousPage: this.getPageCleanupContextBlocks(previousPage, "previous"),
      nextPage: this.getPageCleanupContextBlocks(nextPage, "next"),
    };
  }

  private getPageCleanupContextBlocks(
    record: PageRecord | null,
    edge: "previous" | "next",
  ): AiCleanupContextBlock[] {
    if (!record?.page.ocrRawJson) {
      return [];
    }

    return selectCleanupContextBlocks(
      normalizeOcrBlocks(
        record.page.ocrRawJson,
        record.page.sourceImage.widthPx,
        record.page.sourceImage.heightPx,
      ),
      edge,
    );
  }
}

function selectCleanupContextBlocks(
  blocks: OcrBlockJson[],
  edge: "previous" | "next",
): AiCleanupContextBlock[] {
  const textBlocks = blocks.filter(
    (block) => block.label === "text" && block.content.trim().length > 0,
  );
  const selectedBlocks =
    edge === "previous"
      ? textBlocks.slice(-CLEANUP_CONTEXT_BLOCK_COUNT)
      : textBlocks.slice(0, CLEANUP_CONTEXT_BLOCK_COUNT);

  return selectedBlocks.map((block) => ({
    label: block.label,
    content: block.content,
  }));
}
