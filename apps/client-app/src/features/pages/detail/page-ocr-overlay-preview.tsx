import { useEffect, useMemo, useRef, useState } from "react";
import { isTextOcrBlockLabel, normalizeOcrBlockLabel } from "@yomika/shared";
import { cn } from "@/lib/utils";
import type { PageBlock, PageImageDimensions } from "./types";
import { getImageAspectRatioStyle } from "./utils";

type PageOcrOverlayPreviewProps = {
  sourceImageUrl: string;
  sourceImageDimensions: PageImageDimensions | null;
  blocks: readonly PageBlock[];
  selectedBlockId: string | null;
  blockVisibility?: "all" | "text";
  onBlockClick: (blockId: string) => void;
};

type PageOverlayBlock = PageBlock & {
  bboxX1: number;
  bboxY1: number;
  bboxX2: number;
  bboxY2: number;
};

const OVERLAY_EXPANSION_PX = 3;

type BlockBorderClasses = {
  idle: string;
  selected: string;
};

const DEFAULT_BLOCK_BORDER_CLASSES: BlockBorderClasses = {
  idle: "border-border bg-transparent hover:border-muted-foreground",
  selected: "border-foreground bg-transparent",
};

const BLOCK_BORDER_COLOR_CLASSES = {
  primaryText: {
    idle: "border-sky-500/70 bg-transparent hover:border-sky-600",
    selected: "border-sky-600 bg-transparent",
  },
  secondaryText: {
    idle: "border-cyan-500/70 bg-transparent hover:border-cyan-600",
    selected: "border-cyan-600 bg-transparent",
  },
  supportingText: {
    idle: "border-teal-500/70 bg-transparent hover:border-teal-600",
    selected: "border-teal-600 bg-transparent",
  },
  majorTitle: {
    idle: "border-fuchsia-500/70 bg-transparent hover:border-fuchsia-600",
    selected: "border-fuchsia-600 bg-transparent",
  },
  sectionTitle: {
    idle: "border-purple-500/70 bg-transparent hover:border-purple-600",
    selected: "border-purple-600 bg-transparent",
  },
  table: {
    idle: "border-emerald-500/70 bg-transparent hover:border-emerald-600",
    selected: "border-emerald-600 bg-transparent",
  },
  tableCaption: {
    idle: "border-green-500/70 bg-transparent hover:border-green-600",
    selected: "border-green-600 bg-transparent",
  },
  media: {
    idle: "border-orange-500/70 bg-transparent hover:border-orange-600",
    selected: "border-orange-600 bg-transparent",
  },
  mediaCaption: {
    idle: "border-amber-500/70 bg-transparent hover:border-amber-600",
    selected: "border-amber-600 bg-transparent",
  },
  chart: {
    idle: "border-yellow-500/70 bg-transparent hover:border-yellow-600",
    selected: "border-yellow-600 bg-transparent",
  },
  pageChrome: {
    idle: "border-indigo-500/70 bg-transparent hover:border-indigo-600",
    selected: "border-indigo-600 bg-transparent",
  },
  note: {
    idle: "border-stone-500/70 bg-transparent hover:border-stone-600",
    selected: "border-stone-600 bg-transparent",
  },
  reference: {
    idle: "border-slate-500/70 bg-transparent hover:border-slate-600",
    selected: "border-slate-600 bg-transparent",
  },
  algorithm: {
    idle: "border-violet-500/70 bg-transparent hover:border-violet-600",
    selected: "border-violet-600 bg-transparent",
  },
  formula: {
    idle: "border-rose-500/70 bg-transparent hover:border-rose-600",
    selected: "border-rose-600 bg-transparent",
  },
  technical: {
    idle: "border-zinc-500/70 bg-transparent hover:border-zinc-600",
    selected: "border-zinc-600 bg-transparent",
  },
} satisfies Record<string, BlockBorderClasses>;

const BLOCK_BORDER_CLASSES_BY_LABEL: Record<string, BlockBorderClasses> = {
  paragraph_title: BLOCK_BORDER_COLOR_CLASSES.sectionTitle,
  image: BLOCK_BORDER_COLOR_CLASSES.media,
  text: BLOCK_BORDER_COLOR_CLASSES.primaryText,
  number: BLOCK_BORDER_COLOR_CLASSES.technical,
  abstract: BLOCK_BORDER_COLOR_CLASSES.secondaryText,
  content: BLOCK_BORDER_COLOR_CLASSES.primaryText,
  figure_title: BLOCK_BORDER_COLOR_CLASSES.mediaCaption,
  formula: BLOCK_BORDER_COLOR_CLASSES.formula,
  table: BLOCK_BORDER_COLOR_CLASSES.table,
  table_title: BLOCK_BORDER_COLOR_CLASSES.tableCaption,
  reference: BLOCK_BORDER_COLOR_CLASSES.reference,
  doc_title: BLOCK_BORDER_COLOR_CLASSES.majorTitle,
  footnote: BLOCK_BORDER_COLOR_CLASSES.note,
  header: BLOCK_BORDER_COLOR_CLASSES.pageChrome,
  algorithm: BLOCK_BORDER_COLOR_CLASSES.algorithm,
  footer: BLOCK_BORDER_COLOR_CLASSES.pageChrome,
  seal: BLOCK_BORDER_COLOR_CLASSES.technical,
  chart_title: BLOCK_BORDER_COLOR_CLASSES.mediaCaption,
  chart: BLOCK_BORDER_COLOR_CLASSES.chart,
  formula_number: BLOCK_BORDER_COLOR_CLASSES.formula,
  header_image: BLOCK_BORDER_COLOR_CLASSES.media,
  footer_image: BLOCK_BORDER_COLOR_CLASSES.media,
  aside_text: BLOCK_BORDER_COLOR_CLASSES.supportingText,
};

function hasUsableBbox(block: PageBlock): block is PageBlock & {
  bboxX1: number;
  bboxY1: number;
  bboxX2: number;
  bboxY2: number;
} {
  return [block.bboxX1, block.bboxY1, block.bboxX2, block.bboxY2].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

function getBlockBorderClasses(
  blockLabel: string | null | undefined,
  isSelected: boolean,
) {
  const normalizedLabel = normalizeOcrBlockLabel(blockLabel);
  const borderClasses =
    BLOCK_BORDER_CLASSES_BY_LABEL[normalizedLabel] ??
    DEFAULT_BLOCK_BORDER_CLASSES;

  return isSelected ? borderClasses.selected : borderClasses.idle;
}

function getBlockVisualLayer(block: PageBlock) {
  const label = normalizeOcrBlockLabel(block.label);

  if (
    label === "image" ||
    label === "header_image" ||
    label === "footer_image"
  ) {
    return 0;
  }

  if (label === "table" || label === "table_title") {
    return 1;
  }

  return 2;
}

function normalizeBlocks(
  blocks: readonly PageBlock[],
  blockVisibility: "all" | "text",
) {
  return blocks
    .flatMap((block): PageOverlayBlock[] =>
      hasUsableBbox(block) &&
      (blockVisibility === "all" ||
        isTextOcrBlockLabel(block.label) ||
        block.segments.length > 0)
        ? [block]
        : [],
    )
    .map((block, index) => ({ block, index }))
    .sort((left, right) => {
      const layerDifference =
        getBlockVisualLayer(left.block) - getBlockVisualLayer(right.block);

      if (layerDifference !== 0) {
        return layerDifference;
      }

      return left.index - right.index;
    })
    .map(({ block }) => block);
}

function getBlockKey(block: PageOverlayBlock) {
  return [
    block.id,
    block.orderIndex,
    block.bboxX1,
    block.bboxY1,
    block.bboxX2,
    block.bboxY2,
  ].join(":");
}

export function PageOcrOverlayPreview({
  sourceImageUrl,
  sourceImageDimensions,
  blocks,
  selectedBlockId,
  blockVisibility = "text",
  onBlockClick,
}: PageOcrOverlayPreviewProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<PageImageDimensions | null>(
    sourceImageDimensions,
  );
  const [renderedSize, setRenderedSize] = useState<PageImageDimensions | null>(
    null,
  );
  const visibleBlocks = useMemo(
    () => normalizeBlocks(blocks, blockVisibility),
    [blockVisibility, blocks],
  );

  useEffect(() => {
    setNaturalSize(sourceImageDimensions);
  }, [
    sourceImageDimensions?.height,
    sourceImageDimensions?.width,
    sourceImageUrl,
  ]);

  useEffect(() => {
    const image = imageRef.current;

    if (!image || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateRenderedSize = () => {
      const rect = image.getBoundingClientRect();

      setRenderedSize((previousSize) => {
        if (
          previousSize?.width === rect.width &&
          previousSize.height === rect.height
        ) {
          return previousSize;
        }

        return { width: rect.width, height: rect.height };
      });
    };
    const observer = new ResizeObserver(updateRenderedSize);

    observer.observe(image);
    updateRenderedSize();

    return () => observer.disconnect();
  }, [sourceImageUrl]);

  const scaleX =
    naturalSize && renderedSize ? renderedSize.width / naturalSize.width : null;
  const scaleY =
    naturalSize && renderedSize
      ? renderedSize.height / naturalSize.height
      : null;

  return (
    <div className="relative">
      <img
        ref={imageRef}
        src={sourceImageUrl}
        alt="Page OCR overlay preview"
        loading="lazy"
        width={sourceImageDimensions?.width}
        height={sourceImageDimensions?.height}
        style={getImageAspectRatioStyle(sourceImageDimensions)}
        className="block h-auto w-full rounded-2xl border border-stone-200 bg-stone-50 object-contain"
        onLoad={(event) => {
          const image = event.currentTarget;
          const rect = image.getBoundingClientRect();

          setNaturalSize({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
          setRenderedSize({ width: rect.width, height: rect.height });
        }}
      />

      {scaleX && scaleY && renderedSize ? (
        <div className="absolute inset-0">
          {visibleBlocks.map((block) => {
            const left = Math.max(
              0,
              block.bboxX1 * scaleX - OVERLAY_EXPANSION_PX,
            );
            const top = Math.max(
              0,
              block.bboxY1 * scaleY - OVERLAY_EXPANSION_PX,
            );
            const right = Math.min(
              renderedSize.width,
              block.bboxX2 * scaleX + OVERLAY_EXPANSION_PX,
            );
            const bottom = Math.min(
              renderedSize.height,
              block.bboxY2 * scaleY + OVERLAY_EXPANSION_PX,
            );
            const isSelected = block.id === selectedBlockId;

            return (
              <button
                key={getBlockKey(block)}
                type="button"
                className={cn(
                  "absolute overflow-hidden rounded shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected ? "border-2" : "border",
                  getBlockBorderClasses(block.label, isSelected),
                )}
                style={{
                  left,
                  top,
                  width: Math.max(1, right - left),
                  height: Math.max(1, bottom - top),
                }}
                aria-label={`OCR block ${block.orderIndex}: ${block.label ?? "unknown"}`}
                aria-pressed={isSelected}
                title={block.label ?? `Block ${block.orderIndex}`}
                onClick={() => onBlockClick(block.id)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
