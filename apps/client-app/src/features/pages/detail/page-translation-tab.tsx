import { PageOcrPreviewCard } from "./page-ocr-preview-card";
import { PageTranslationSegmentsCard } from "./page-translation-segments-card";
import type { PageBlock, PageImageDimensions } from "./types";
import {
  getSelectedOrFirstBlock,
  getSiblingBlock,
  isTranslationBlock,
} from "./utils";

type PageTranslationTabProps = {
  pagePath: string;
  sourceImageUrl: string;
  sourceImageDimensions: PageImageDimensions | null;
  blocks: readonly PageBlock[];
  translationSourceLanguages: readonly string[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
};

export function PageTranslationTab({
  pagePath,
  sourceImageUrl,
  sourceImageDimensions,
  blocks,
  translationSourceLanguages,
  selectedBlockId,
  onSelectBlock,
}: PageTranslationTabProps) {
  const translationBlocks = blocks.filter(isTranslationBlock);
  const selectedBlock = getSelectedOrFirstBlock(
    translationBlocks,
    selectedBlockId,
  );
  const resolvedSelectedBlockId = selectedBlock?.id ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(540px,50%)]">
      <PageOcrPreviewCard
        sourceImageUrl={sourceImageUrl}
        sourceImageDimensions={sourceImageDimensions}
        blocks={translationBlocks}
        selectedBlockId={resolvedSelectedBlockId}
        blockVisibility="text"
        onBlockClick={onSelectBlock}
      />
      <PageTranslationSegmentsCard
        pagePath={pagePath}
        selectedBlock={selectedBlock}
        translationSourceLanguages={translationSourceLanguages}
        previousBlock={getSiblingBlock(
          translationBlocks,
          resolvedSelectedBlockId,
          "previous",
        )}
        nextBlock={getSiblingBlock(
          translationBlocks,
          resolvedSelectedBlockId,
          "next",
        )}
        onSelectBlock={onSelectBlock}
      />
    </div>
  );
}
