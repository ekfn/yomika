import type { OcrBlockJson } from "@/library/library-schemas";
import { convertOcrTableHtmlToTsv } from "./ocr-cleanup-table-html";

type PaddleOcrResultEnvelope = {
  results: Array<{
    res?: {
      width?: unknown;
      height?: unknown;
      parsing_res_list?: unknown;
    } | null;
  }>;
};

type PaddleOcrParsingEntry = {
  block_id: number;
  block_label: string;
  block_order: number | null;
  block_content: string;
  block_bbox: [number, number, number, number];
};

export type NormalizedPaddleOcrBlock = PaddleOcrParsingEntry;

export function normalizePaddleOcrBlocks(
  ocrRawJson: unknown,
  sourceImageWidthPx: number,
  sourceImageHeightPx: number,
): NormalizedPaddleOcrBlock[] {
  if (!Number.isFinite(sourceImageWidthPx) || sourceImageWidthPx <= 0) {
    throw new Error("Source image width must be a positive number.");
  }

  if (!Number.isFinite(sourceImageHeightPx) || sourceImageHeightPx <= 0) {
    throw new Error("Source image height must be a positive number.");
  }

  const envelope = assertPaddleOcrResultEnvelope(ocrRawJson);
  const primaryResult = envelope.results[0];

  if (
    typeof primaryResult !== "object" ||
    primaryResult === null ||
    typeof primaryResult.res !== "object" ||
    primaryResult.res === null
  ) {
    throw new Error("PaddleOCR returned a primary result without res.");
  }

  const res = primaryResult.res;

  if (
    typeof res.width !== "number" ||
    !Number.isFinite(res.width) ||
    res.width <= 0
  ) {
    throw new Error("PaddleOCR returned an invalid res.width value.");
  }

  if (
    res.height !== undefined &&
    (typeof res.height !== "number" ||
      !Number.isFinite(res.height) ||
      res.height <= 0)
  ) {
    throw new Error("PaddleOCR returned an invalid res.height value.");
  }

  if (!Array.isArray(res.parsing_res_list)) {
    throw new Error("PaddleOCR returned an invalid parsing_res_list value.");
  }

  const scaleX = sourceImageWidthPx / res.width;
  const scaleY =
    typeof res.height === "number" && res.height > 0
      ? sourceImageHeightPx / res.height
      : scaleX;

  return res.parsing_res_list.map((entry, index) => {
    const parsedEntry = parseParsingEntry(entry, index);
    const bbox = [
      Math.round(parsedEntry.block_bbox[0] * scaleX),
      Math.round(parsedEntry.block_bbox[1] * scaleY),
      Math.round(parsedEntry.block_bbox[2] * scaleX),
      Math.round(parsedEntry.block_bbox[3] * scaleY),
    ] as PaddleOcrParsingEntry["block_bbox"];

    return {
      ...parsedEntry,
      block_bbox: bbox,
    };
  });
}

export function normalizeOcrBlocks(
  ocrRawJson: unknown,
  sourceImageWidthPx: number,
  sourceImageHeightPx: number,
): OcrBlockJson[] {
  const blockIds = new Set<number>();

  return normalizePaddleOcrBlocks(
    ocrRawJson,
    sourceImageWidthPx,
    sourceImageHeightPx,
  ).map((entry, index) => {
    if (blockIds.has(entry.block_id)) {
      throw new Error(
        `PaddleOCR returned duplicate block_id ${entry.block_id}.`,
      );
    }

    blockIds.add(entry.block_id);

    return {
      id: String(entry.block_id),
      orderIndex: entry.block_order ?? index,
      label: entry.block_label,
      bboxX1: entry.block_bbox[0],
      bboxY1: entry.block_bbox[1],
      bboxX2: entry.block_bbox[2],
      bboxY2: entry.block_bbox[3],
      content:
        entry.block_label === "table"
          ? convertOcrTableHtmlToTsv(entry.block_content)
          : entry.block_content,
    };
  });
}

function assertPaddleOcrResultEnvelope(
  ocrRawJson: unknown,
): PaddleOcrResultEnvelope {
  if (
    typeof ocrRawJson !== "object" ||
    ocrRawJson === null ||
    !("results" in ocrRawJson) ||
    !Array.isArray((ocrRawJson as { results?: unknown }).results) ||
    (ocrRawJson as { results: unknown[] }).results.length === 0
  ) {
    throw new Error("PaddleOCR returned empty JSON results.");
  }

  return ocrRawJson as PaddleOcrResultEnvelope;
}

function parseParsingEntry(
  entry: unknown,
  index: number,
): PaddleOcrParsingEntry {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(
      `PaddleOCR returned invalid parsing_res_list entry at index ${index}.`,
    );
  }

  const record = entry as Record<string, unknown>;
  const blockId = record.block_id;
  const blockLabel = record.block_label;
  const blockOrder = record.block_order;
  const blockContent = record.block_content;
  const blockBbox = record.block_bbox;

  if (typeof blockId !== "number" || !Number.isInteger(blockId)) {
    throw new Error(
      `PaddleOCR returned invalid block_id at parsing_res_list index ${index}.`,
    );
  }

  if (typeof blockLabel !== "string") {
    throw new Error(
      `PaddleOCR returned invalid block_label at parsing_res_list index ${index}.`,
    );
  }

  if (
    blockOrder !== null &&
    blockOrder !== undefined &&
    (typeof blockOrder !== "number" || !Number.isInteger(blockOrder))
  ) {
    throw new Error(
      `PaddleOCR returned invalid block_order at parsing_res_list index ${index}.`,
    );
  }

  if (typeof blockContent !== "string") {
    throw new Error(
      `PaddleOCR returned invalid block_content at parsing_res_list index ${index}.`,
    );
  }

  if (!Array.isArray(blockBbox) || blockBbox.length !== 4) {
    throw new Error(
      `PaddleOCR returned invalid block_bbox at parsing_res_list index ${index}.`,
    );
  }

  if (
    blockBbox.some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    )
  ) {
    throw new Error(
      `PaddleOCR returned non-numeric block_bbox coordinates at parsing_res_list index ${index}.`,
    );
  }

  return {
    block_id: blockId,
    block_label: blockLabel,
    block_order: blockOrder == null ? null : blockOrder,
    block_content: blockContent,
    block_bbox: blockBbox as PaddleOcrParsingEntry["block_bbox"],
  };
}
