import { useEffect, useMemo, useState } from "react";
import {
  PageBlockContentCard,
  type BlockContentTabValue,
} from "./page-block-content-card";
import { PageOcrPreviewCard } from "./page-ocr-preview-card";
import { parseRawOcrBlocks, toRawOcrPreviewBlocks } from "./raw-ocr-blocks";
import type { PageBlock, PageImageDimensions } from "./types";
import { getSelectedOrFirstBlock, getSiblingBlock } from "./utils";

type PageOcrTabProps = {
  pagePath: string;
  sourceImageUrl: string;
  sourceImageDimensions: PageImageDimensions | null;
  ocrRawJson: string | null;
  blocks: readonly PageBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
};

export function PageOcrTab({
  pagePath,
  sourceImageUrl,
  sourceImageDimensions,
  ocrRawJson,
  blocks,
  selectedBlockId,
  onSelectBlock,
}: PageOcrTabProps) {
  const rawBlocksResult = useMemo(
    () => parseRawOcrBlocks(ocrRawJson),
    [ocrRawJson],
  );
  const rawPreviewBlocks = useMemo(
    () => toRawOcrPreviewBlocks(rawBlocksResult, sourceImageDimensions),
    [rawBlocksResult, sourceImageDimensions],
  );
  const selectedBlock = getSelectedOrFirstBlock(blocks, selectedBlockId);
  const defaultContentTab: BlockContentTabValue = selectedBlock
    ? "blocks"
    : "rawBlocks";
  const [selectedContentTab, setSelectedContentTab] =
    useState<BlockContentTabValue>(defaultContentTab);
  const previewBlocks =
    selectedContentTab === "rawBlocks" ? rawPreviewBlocks : blocks;
  const selectedPreviewBlock = getSelectedOrFirstBlock(
    previewBlocks,
    selectedBlockId,
  );
  const selectedPreviewBlockId = selectedPreviewBlock?.id ?? null;
  const selectedCleanedBlockId = selectedBlock?.id ?? null;

  useEffect(() => {
    setSelectedContentTab(defaultContentTab);
  }, [defaultContentTab, pagePath]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(540px,50%)]">
      <PageOcrPreviewCard
        sourceImageUrl={sourceImageUrl}
        sourceImageDimensions={sourceImageDimensions}
        blocks={previewBlocks}
        selectedBlockId={selectedPreviewBlockId}
        blockVisibility="all"
        onBlockClick={onSelectBlock}
      />
      <PageBlockContentCard
        pagePath={pagePath}
        ocrRawJson={ocrRawJson}
        selectedTab={selectedContentTab}
        selectedBlock={selectedBlock}
        previousBlock={getSiblingBlock(
          blocks,
          selectedCleanedBlockId,
          "previous",
        )}
        nextBlock={getSiblingBlock(blocks, selectedCleanedBlockId, "next")}
        onSelectBlock={onSelectBlock}
        onSelectedTabChange={setSelectedContentTab}
      />
    </div>
  );
}
