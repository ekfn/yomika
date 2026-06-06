import { PageOcrOverlayPreview } from "./page-ocr-overlay-preview";
import type { PageBlock, PageImageDimensions } from "./types";

type PageOcrPreviewCardProps = {
  sourceImageUrl: string;
  sourceImageDimensions: PageImageDimensions | null;
  blocks: readonly PageBlock[];
  selectedBlockId: string | null;
  blockVisibility?: "all" | "text";
  onBlockClick: (blockId: string) => void;
};

export function PageOcrPreviewCard({
  sourceImageUrl,
  sourceImageDimensions,
  blocks,
  selectedBlockId,
  blockVisibility = "text",
  onBlockClick,
}: PageOcrPreviewCardProps) {
  return (
    <PageOcrOverlayPreview
      sourceImageUrl={sourceImageUrl}
      sourceImageDimensions={sourceImageDimensions}
      blocks={blocks}
      selectedBlockId={selectedBlockId}
      blockVisibility={blockVisibility}
      onBlockClick={onBlockClick}
    />
  );
}
