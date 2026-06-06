import { getPageDisplayName } from "@yomika/shared";
import { isTextOcrBlockLabel } from "@yomika/shared";
import type { PageBlock, PageDetail, PageImageDimensions } from "./types";

export function getPageDisplayTitle(page: PageDetail): string {
  return getPageDisplayName(page.path);
}

export function getSourceImageDimensions(
  page: PageDetail,
): PageImageDimensions | null {
  if (!page.sourceImageWidthPx || !page.sourceImageHeightPx) {
    return null;
  }

  return {
    width: page.sourceImageWidthPx,
    height: page.sourceImageHeightPx,
  };
}

export function getImageAspectRatioStyle(
  dimensions: PageImageDimensions | null,
) {
  if (!dimensions) {
    return undefined;
  }

  return {
    aspectRatio: `${dimensions.width} / ${dimensions.height}`,
  };
}

export function isTextBlock(block: PageBlock): boolean {
  if (!block.label) {
    return block.segments.length > 0;
  }

  return isTextOcrBlockLabel(block.label) || block.segments.length > 0;
}

export function isTranslationBlock(block: PageBlock): boolean {
  return isTextBlock(block) && block.content.trim().length > 0;
}

export function getSelectedOrFirstBlock(
  blocks: readonly PageBlock[],
  selectedBlockId: string | null,
): PageBlock | null {
  if (selectedBlockId) {
    const selectedBlock = blocks.find((block) => block.id === selectedBlockId);

    if (selectedBlock) {
      return selectedBlock;
    }
  }

  return blocks[0] ?? null;
}

export function getSiblingBlock(
  blocks: readonly PageBlock[],
  selectedBlockId: string | null,
  direction: "previous" | "next",
): PageBlock | null {
  const selectedIndex = selectedBlockId
    ? blocks.findIndex((block) => block.id === selectedBlockId)
    : -1;

  if (direction === "previous") {
    return selectedIndex > 0 ? (blocks[selectedIndex - 1] ?? null) : null;
  }

  return selectedIndex >= 0 && selectedIndex < blocks.length - 1
    ? (blocks[selectedIndex + 1] ?? null)
    : null;
}

export function formatBlockLabel(block: PageBlock): string {
  return `Block ${block.orderIndex}${block.label ? ` · ${block.label}` : ""}`;
}

export function formatCoordinate(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(0)
    : "n/a";
}
