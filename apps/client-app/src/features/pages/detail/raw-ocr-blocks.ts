import type { PageBlock } from "./types";

export type RawOcrBlock = {
  key: string;
  orderIndex: number | null;
  label: string | null;
  bbox: [number, number, number, number] | null;
  content: string;
};

export type RawOcrBlocksResult =
  | {
      status: "ready";
      sourceWidthPx: number | null;
      sourceHeightPx: number | null;
      blocks: RawOcrBlock[];
    }
  | {
      status: "missing" | "invalid";
      message: string;
      blocks: [];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRawOcrParsingResult(ocrRawJson: unknown): {
  sourceWidthPx: number | null;
  sourceHeightPx: number | null;
  parsingList: unknown[];
} | null {
  if (!isRecord(ocrRawJson)) {
    return null;
  }

  const results = ocrRawJson.results;

  if (!Array.isArray(results) || !isRecord(results[0])) {
    return null;
  }

  const res = results[0].res;

  if (!isRecord(res) || !Array.isArray(res.parsing_res_list)) {
    return null;
  }

  const width = res.width;
  const height = res.height;

  return {
    sourceWidthPx:
      typeof width === "number" && Number.isFinite(width) && width > 0
        ? width
        : null,
    sourceHeightPx:
      typeof height === "number" && Number.isFinite(height) && height > 0
        ? height
        : null,
    parsingList: res.parsing_res_list,
  };
}

function parseRawBbox(value: unknown): RawOcrBlock["bbox"] {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some(
      (coordinate) =>
        typeof coordinate !== "number" || !Number.isFinite(coordinate),
    )
  ) {
    return null;
  }

  return value as [number, number, number, number];
}

export function parseRawOcrBlocks(
  ocrRawJson: string | null,
): RawOcrBlocksResult {
  if (!ocrRawJson) {
    return {
      status: "missing",
      message: "Raw OCR blocks are not available yet.",
      blocks: [],
    };
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(ocrRawJson);
  } catch {
    return {
      status: "invalid",
      message: "Raw OCR JSON could not be parsed.",
      blocks: [],
    };
  }

  const parsingResult = getRawOcrParsingResult(parsedJson);

  if (!parsingResult) {
    return {
      status: "invalid",
      message: "Raw OCR JSON does not contain parsing_res_list.",
      blocks: [],
    };
  }

  return {
    status: "ready",
    sourceWidthPx: parsingResult.sourceWidthPx,
    sourceHeightPx: parsingResult.sourceHeightPx,
    blocks: parsingResult.parsingList.map((entry, index) => {
      const record = isRecord(entry) ? entry : {};
      const label = record.block_label;
      const orderIndex = record.block_order;
      const content = record.block_content;

      return {
        key: `raw-block-${index}`,
        orderIndex:
          typeof orderIndex === "number" && Number.isFinite(orderIndex)
            ? orderIndex
            : null,
        label: typeof label === "string" ? label : null,
        bbox: parseRawBbox(record.block_bbox),
        content: typeof content === "string" ? content : "",
      };
    }),
  };
}

export function toRawOcrPreviewBlocks(
  result: RawOcrBlocksResult,
  sourceImageDimensions:
    | {
        width: number;
        height: number;
      }
    | null
    | undefined,
): PageBlock[] {
  if (result.status !== "ready") {
    return [];
  }

  const scaleX =
    result.sourceWidthPx && sourceImageDimensions?.width
      ? sourceImageDimensions.width / result.sourceWidthPx
      : 1;
  const scaleY =
    result.sourceHeightPx && sourceImageDimensions?.height
      ? sourceImageDimensions.height / result.sourceHeightPx
      : scaleX;

  return result.blocks.flatMap((block, index): PageBlock[] => {
    if (!block.bbox) {
      return [];
    }

    return [
      {
        id: `raw:${block.key}`,
        orderIndex: block.orderIndex ?? index,
        label: block.label,
        bboxX1: Math.round(block.bbox[0] * scaleX),
        bboxY1: Math.round(block.bbox[1] * scaleY),
        bboxX2: Math.round(block.bbox[2] * scaleX),
        bboxY2: Math.round(block.bbox[3] * scaleY),
        content: block.content,
        segments: [],
      },
    ];
  });
}
