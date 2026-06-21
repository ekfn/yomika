import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { Injectable } from "@nestjs/common";
import sharp from "sharp";
import { Agent } from "undici";
import { loadAppConfig } from "@/config/app-config";
import { normalizePaddleOcrBlocks } from "./ocr-normalization";

export type PaddleOcrRunMetadata = {
  mimeType: string;
  widthPx: number;
  heightPx: number;
};

type PaddleOcrVlPageJsonResult = Record<string, unknown>;

type PaddleOcrVlJsonResult = {
  results: PaddleOcrVlPageJsonResult[];
};

type OcrImageTransform = {
  sourceWidthPx: number;
  sourceHeightPx: number;
  cropLeftPx: number;
  cropTopPx: number;
  cropWidthPx: number;
  cropHeightPx: number;
  ocrWidthPx: number;
  ocrHeightPx: number;
};

type TrimBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type NormalizedOcrImage = {
  buffer: Buffer;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  transform: OcrImageTransform;
};

type ContentFocusedOcrImage = NormalizedOcrImage;

type OcrContentCropPadding = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type PaddleOcrTextImageLine = {
  text: string;
  confidence: number | null;
  bbox: [number, number, number, number] | null;
};

type PaddleOcrTextDetectionLine = {
  text: string;
  confidence: number | null;
  bbox: [number, number, number, number];
};

type PaddleOcrTextDetectionResult = {
  text: string;
  lines: PaddleOcrTextDetectionLine[];
};

type PaddleOcrTextImageResult = {
  text: string;
  lines: PaddleOcrTextImageLine[];
};

const OCR_TARGET_MAX_PIXELS = 4_000_000;
const OCR_WHITE_TRIM_MIN_CHANNEL = 245;
const OCR_TRIM_PADDING_RATIO = 0.02;
const OCR_CONTENT_CROP_PADDING_MIN_PX = 24;
const OCR_CONTENT_CROP_PADDING_RATIO = 0.02;
const IMAGE_BLOCK_LABEL = "image";
const PADDLE_OCR_REQUEST_TIMEOUT_MS = 30 * 60 * 1000;
const paddleOcrDispatcher = new Agent({
  headersTimeout: PADDLE_OCR_REQUEST_TIMEOUT_MS,
  bodyTimeout: PADDLE_OCR_REQUEST_TIMEOUT_MS,
});

function fetchPaddleOcr(
  endpoint: string,
  init: RequestInit,
): Promise<Response> {
  const requestInit: RequestInit & { dispatcher: Agent } = {
    ...init,
    dispatcher: paddleOcrDispatcher,
  };

  return fetch(endpoint, requestInit);
}

function buildOcrUploadFilename(sourceImagePath: string, mimeType: string) {
  const sourceName = basename(sourceImagePath, extname(sourceImagePath));

  switch (mimeType) {
    case "image/jpeg":
      return `${sourceName}.jpg`;
    case "image/png":
      return `${sourceName}.png`;
    case "image/webp":
      return `${sourceName}.webp`;
    default:
      return basename(sourceImagePath);
  }
}

function buildTextImageUploadFilename(sourceImagePath: string): string {
  const sourceName = basename(sourceImagePath, extname(sourceImagePath));

  return `${sourceName}.png`;
}

function toBlobPart(buffer: Buffer): BlobPart {
  return new Uint8Array(buffer);
}

function getErrorRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : null;
}

function getErrorStringProperty(
  error: unknown,
  property: string,
): string | null {
  const value = getErrorRecord(error)?.[property];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function getErrorDetailProperty(
  error: unknown,
  property: string,
): string | null {
  const value = getErrorRecord(error)?.[property];

  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return null;
  }

  return `${property}=${String(value)}`;
}

function getNestedErrors(error: unknown): unknown[] {
  const errors = getErrorRecord(error)?.errors;

  return Array.isArray(errors) ? errors : [];
}

function describeErrorLike(error: unknown): string {
  const name =
    error instanceof Error ? error.name : getErrorStringProperty(error, "name");
  const message =
    error instanceof Error
      ? error.message
      : getErrorStringProperty(error, "message");
  const label =
    name && message
      ? `${name}: ${message}`
      : (message ?? name ?? String(error));
  const details = ["code", "errno", "syscall", "address", "port"]
    .map((property) => getErrorDetailProperty(error, property))
    .filter((detail): detail is string => detail !== null);

  return details.length > 0 ? `${label} (${details.join(", ")})` : label;
}

function formatFetchError(error: unknown): string {
  const message = describeErrorLike(error);
  const cause = getErrorRecord(error)?.cause;
  const details: string[] = [];

  if (cause !== undefined) {
    details.push(`cause: ${describeErrorLike(cause)}`);

    const causeErrors = getNestedErrors(cause);

    if (causeErrors.length > 0) {
      details.push(
        `cause errors: ${causeErrors.map(describeErrorLike).join("; ")}`,
      );
    }
  }

  const errors = getNestedErrors(error);

  if (errors.length > 0) {
    details.push(`errors: ${errors.map(describeErrorLike).join("; ")}`);
  }

  return details.length > 0 ? `${message}; ${details.join("; ")}` : message;
}

function normalizeOcrBlockLabel(blockLabel: string | null | undefined): string {
  return (blockLabel ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isNonWhitePixel(input: {
  data: Buffer;
  index: number;
  channels: number;
}) {
  const red = input.data[input.index];
  const green = input.data[input.index + 1];
  const blue = input.data[input.index + 2];
  const alpha = input.channels >= 4 ? input.data[input.index + 3] : 255;

  if (alpha === undefined || alpha < 16) {
    return false;
  }

  return (
    red === undefined ||
    green === undefined ||
    blue === undefined ||
    red < OCR_WHITE_TRIM_MIN_CHANNEL ||
    green < OCR_WHITE_TRIM_MIN_CHANNEL ||
    blue < OCR_WHITE_TRIM_MIN_CHANNEL
  );
}

async function findNonWhiteTrimBox(input: {
  sourceImageBuffer: Buffer;
}): Promise<TrimBox | null> {
  const { data, info } = await sharp(input.sourceImageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * channels;

    for (let x = 0; x < width; x += 1) {
      const index = rowOffset + x * channels;

      if (!isNonWhitePixel({ data, index, channels })) {
        continue;
      }

      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    return null;
  }

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function addBoundedTrimPadding(input: {
  trimBox: TrimBox;
  sourceWidthPx: number;
  sourceHeightPx: number;
}) {
  const paddingX = Math.round(input.sourceWidthPx * OCR_TRIM_PADDING_RATIO);
  const paddingY = Math.round(input.sourceHeightPx * OCR_TRIM_PADDING_RATIO);
  const left = Math.max(0, input.trimBox.left - paddingX);
  const top = Math.max(0, input.trimBox.top - paddingY);
  const right = Math.min(
    input.sourceWidthPx,
    input.trimBox.left + input.trimBox.width + paddingX,
  );
  const bottom = Math.min(
    input.sourceHeightPx,
    input.trimBox.top + input.trimBox.height + paddingY,
  );

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

async function trimWhiteMargins(input: {
  sourceImageBuffer: Buffer;
  widthPx: number;
  heightPx: number;
}) {
  const trimBox = await findNonWhiteTrimBox({
    sourceImageBuffer: input.sourceImageBuffer,
  });

  if (!trimBox) {
    return null;
  }

  const cropBox = addBoundedTrimPadding({
    trimBox,
    sourceWidthPx: input.widthPx,
    sourceHeightPx: input.heightPx,
  });

  if (cropBox.width === input.widthPx && cropBox.height === input.heightPx) {
    return {
      buffer: input.sourceImageBuffer,
      cropBox,
    };
  }

  const buffer = await sharp(input.sourceImageBuffer)
    .extract(cropBox)
    .png()
    .toBuffer();

  return {
    buffer,
    cropBox,
  };
}

async function normalizeImageForOcr(input: {
  sourceImageBuffer: Buffer;
  mimeType: string;
  widthPx: number;
  heightPx: number;
}): Promise<NormalizedOcrImage | null> {
  const trimmedImage = await trimWhiteMargins(input);

  if (!trimmedImage) {
    return null;
  }

  const cropPixels = trimmedImage.cropBox.width * trimmedImage.cropBox.height;

  if (cropPixels <= OCR_TARGET_MAX_PIXELS) {
    return {
      buffer: trimmedImage.buffer,
      mimeType:
        trimmedImage.buffer === input.sourceImageBuffer
          ? input.mimeType
          : "image/png",
      widthPx: trimmedImage.cropBox.width,
      heightPx: trimmedImage.cropBox.height,
      transform: {
        sourceWidthPx: input.widthPx,
        sourceHeightPx: input.heightPx,
        cropLeftPx: trimmedImage.cropBox.left,
        cropTopPx: trimmedImage.cropBox.top,
        cropWidthPx: trimmedImage.cropBox.width,
        cropHeightPx: trimmedImage.cropBox.height,
        ocrWidthPx: trimmedImage.cropBox.width,
        ocrHeightPx: trimmedImage.cropBox.height,
      },
    };
  }

  const scale = Math.sqrt(OCR_TARGET_MAX_PIXELS / cropPixels);
  const targetWidth = Math.max(
    1,
    Math.floor(trimmedImage.cropBox.width * scale),
  );
  const targetHeight = Math.max(
    1,
    Math.floor(trimmedImage.cropBox.height * scale),
  );
  const { data, info } = await sharp(trimmedImage.buffer)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType: "image/png",
    widthPx: info.width,
    heightPx: info.height,
    transform: {
      sourceWidthPx: input.widthPx,
      sourceHeightPx: input.heightPx,
      cropLeftPx: trimmedImage.cropBox.left,
      cropTopPx: trimmedImage.cropBox.top,
      cropWidthPx: trimmedImage.cropBox.width,
      cropHeightPx: trimmedImage.cropBox.height,
      ocrWidthPx: info.width,
      ocrHeightPx: info.height,
    },
  };
}

function parseTextImageLine(
  line: unknown,
  index: number,
): PaddleOcrTextImageLine {
  if (typeof line !== "object" || line === null) {
    throw new Error(
      `PaddleOCR text-image returned invalid line at index ${index}.`,
    );
  }

  const lineRecord = line as Record<string, unknown>;
  const text = lineRecord.text;
  const confidence = lineRecord.confidence;
  const bbox = lineRecord.bbox;

  if (typeof text !== "string") {
    throw new Error(
      `PaddleOCR text-image returned invalid line text at index ${index}.`,
    );
  }

  if (
    confidence !== null &&
    confidence !== undefined &&
    (typeof confidence !== "number" || !Number.isFinite(confidence))
  ) {
    throw new Error(
      `PaddleOCR text-image returned invalid line confidence at index ${index}.`,
    );
  }

  if (bbox !== null && bbox !== undefined) {
    if (
      !Array.isArray(bbox) ||
      bbox.length !== 4 ||
      bbox.some((value) => typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error(
        `PaddleOCR text-image returned invalid line bbox at index ${index}.`,
      );
    }

    return {
      text,
      confidence: confidence == null ? null : confidence,
      bbox: bbox as [number, number, number, number],
    };
  }

  return {
    text,
    confidence: confidence == null ? null : confidence,
    bbox: null,
  };
}

function parseTextDetectionLine(
  line: unknown,
  index: number,
): PaddleOcrTextDetectionLine {
  const parsedLine = parseTextImageLine(line, index);

  if (!parsedLine.bbox) {
    throw new Error(
      `PaddleOCR text-detection returned missing line bbox at index ${index}.`,
    );
  }

  return {
    text: parsedLine.text,
    confidence: parsedLine.confidence,
    bbox: parsedLine.bbox,
  };
}

function parseTextDetectionResult(
  result: unknown,
): PaddleOcrTextDetectionResult {
  const parsedResult = parseTextImageResult(result, "text-detection");

  return {
    text: parsedResult.text,
    lines: parsedResult.lines.map(parseTextDetectionLine),
  };
}

function parseTextImageResult(
  result: unknown,
  processName = "text-image",
): PaddleOcrTextImageResult {
  if (typeof result !== "object" || result === null) {
    throw new Error(`PaddleOCR ${processName} returned invalid JSON.`);
  }

  const resultRecord = result as Record<string, unknown>;
  const text = resultRecord.text;
  const lines = resultRecord.lines;

  if (typeof text !== "string") {
    throw new Error(`PaddleOCR ${processName} returned invalid text.`);
  }

  if (!Array.isArray(lines)) {
    throw new Error(`PaddleOCR ${processName} returned invalid lines.`);
  }

  return {
    text,
    lines: lines.map(parseTextImageLine),
  };
}

async function postPaddleOcrPng(input: {
  endpoint: string;
  sourceImagePath: string;
  imageBuffer: Buffer;
  processName: string;
}) {
  const formData = new FormData();

  formData.append(
    "file",
    new Blob([toBlobPart(input.imageBuffer)], {
      type: "image/png",
    }),
    buildTextImageUploadFilename(input.sourceImagePath),
  );

  let response: Response;

  try {
    response = await fetchPaddleOcr(input.endpoint, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    const message = formatFetchError(error);

    throw new Error(
      `PaddleOCR ${input.processName} network request failed for ${input.endpoint}: ${message}`,
      { cause: error },
    );
  }

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `PaddleOCR ${input.processName} request failed with ${response.status}: ${detail}`,
    );
  }

  return response.json() as Promise<unknown>;
}

async function runPaddleOcrTextDetection(input: {
  paddleOcrVlBaseUrl: string;
  imageBuffer: Buffer;
  sourceImagePath: string;
}): Promise<PaddleOcrTextDetectionResult> {
  const endpoint = `${input.paddleOcrVlBaseUrl}/ocr/paddleocr/text-detection`;
  const result = await postPaddleOcrPng({
    endpoint,
    sourceImagePath: input.sourceImagePath,
    imageBuffer: input.imageBuffer,
    processName: "text-detection",
  });

  return parseTextDetectionResult(result);
}

async function runPaddleOcrTextImage(input: {
  paddleOcrVlBaseUrl: string;
  imageBuffer: Buffer;
  sourceImagePath: string;
}): Promise<PaddleOcrTextImageResult> {
  const endpoint = `${input.paddleOcrVlBaseUrl}/ocr/paddleocr/text-image`;
  const result = await postPaddleOcrPng({
    endpoint,
    sourceImagePath: input.sourceImagePath,
    imageBuffer: input.imageBuffer,
    processName: "text-image",
  });

  return parseTextImageResult(result);
}

function getTextDetectionContentBox(input: {
  lines: PaddleOcrTextDetectionLine[];
  widthPx: number;
  heightPx: number;
}): TrimBox | null {
  const boxes = input.lines
    .map((line) => line.bbox)
    .filter((bbox) => bbox[2] > bbox[0] && bbox[3] > bbox[1]);

  if (boxes.length === 0) {
    return null;
  }

  const left = clamp(
    Math.floor(Math.min(...boxes.map((bbox) => bbox[0]))),
    0,
    input.widthPx,
  );
  const top = clamp(
    Math.floor(Math.min(...boxes.map((bbox) => bbox[1]))),
    0,
    input.heightPx,
  );
  const right = clamp(
    Math.ceil(Math.max(...boxes.map((bbox) => bbox[2]))),
    0,
    input.widthPx,
  );
  const bottom = clamp(
    Math.ceil(Math.max(...boxes.map((bbox) => bbox[3]))),
    0,
    input.heightPx,
  );

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function getContentCropPadding(contentBox: TrimBox): OcrContentCropPadding {
  const paddingX = Math.max(
    OCR_CONTENT_CROP_PADDING_MIN_PX,
    Math.round(contentBox.width * OCR_CONTENT_CROP_PADDING_RATIO),
  );
  const paddingY = Math.max(
    OCR_CONTENT_CROP_PADDING_MIN_PX,
    Math.round(contentBox.height * OCR_CONTENT_CROP_PADDING_RATIO),
  );

  return {
    left: paddingX,
    top: paddingY,
    right: paddingX,
    bottom: paddingY,
  };
}

function composeContentFocusedTransform(input: {
  normalizedTransform: OcrImageTransform;
  contentBox: TrimBox;
  padding: OcrContentCropPadding;
  ocrWidthPx: number;
  ocrHeightPx: number;
}): OcrImageTransform {
  const scaleX =
    input.normalizedTransform.cropWidthPx /
    input.normalizedTransform.ocrWidthPx;
  const scaleY =
    input.normalizedTransform.cropHeightPx /
    input.normalizedTransform.ocrHeightPx;

  return {
    sourceWidthPx: input.normalizedTransform.sourceWidthPx,
    sourceHeightPx: input.normalizedTransform.sourceHeightPx,
    cropLeftPx:
      input.normalizedTransform.cropLeftPx +
      (input.contentBox.left - input.padding.left) * scaleX,
    cropTopPx:
      input.normalizedTransform.cropTopPx +
      (input.contentBox.top - input.padding.top) * scaleY,
    cropWidthPx: input.ocrWidthPx * scaleX,
    cropHeightPx: input.ocrHeightPx * scaleY,
    ocrWidthPx: input.ocrWidthPx,
    ocrHeightPx: input.ocrHeightPx,
  };
}

async function createContentFocusedOcrImage(input: {
  normalizedImage: NormalizedOcrImage;
  contentBox: TrimBox;
}): Promise<ContentFocusedOcrImage> {
  const padding = getContentCropPadding(input.contentBox);
  const { data, info } = await sharp(input.normalizedImage.buffer)
    .extract(input.contentBox)
    .extend({
      ...padding,
      background: {
        r: 255,
        g: 255,
        b: 255,
        alpha: 1,
      },
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType: "image/png",
    widthPx: info.width,
    heightPx: info.height,
    transform: composeContentFocusedTransform({
      normalizedTransform: input.normalizedImage.transform,
      contentBox: input.contentBox,
      padding,
      ocrWidthPx: info.width,
      ocrHeightPx: info.height,
    }),
  };
}

async function focusImageOnDetectedTextContent(input: {
  paddleOcrVlBaseUrl: string;
  normalizedImage: NormalizedOcrImage;
  sourceImagePath: string;
}): Promise<ContentFocusedOcrImage> {
  const detectionImageBuffer =
    input.normalizedImage.mimeType === "image/png"
      ? input.normalizedImage.buffer
      : await sharp(input.normalizedImage.buffer).png().toBuffer();
  const detection = await runPaddleOcrTextDetection({
    paddleOcrVlBaseUrl: input.paddleOcrVlBaseUrl,
    imageBuffer: detectionImageBuffer,
    sourceImagePath: `${input.sourceImagePath}-text-detection.png`,
  });
  const contentBox = getTextDetectionContentBox({
    lines: detection.lines,
    widthPx: input.normalizedImage.widthPx,
    heightPx: input.normalizedImage.heightPx,
  });

  if (!contentBox) {
    return input.normalizedImage;
  }

  return createContentFocusedOcrImage({
    normalizedImage: input.normalizedImage,
    contentBox,
  });
}

function getClampedExtractBox(input: {
  bbox: [number, number, number, number];
  sourceImageWidthPx: number;
  sourceImageHeightPx: number;
}) {
  const left = Math.max(0, Math.min(input.sourceImageWidthPx, input.bbox[0]));
  const top = Math.max(0, Math.min(input.sourceImageHeightPx, input.bbox[1]));
  const right = Math.max(0, Math.min(input.sourceImageWidthPx, input.bbox[2]));
  const bottom = Math.max(
    0,
    Math.min(input.sourceImageHeightPx, input.bbox[3]),
  );
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    left,
    top,
    width,
    height,
  };
}

async function extractImageBlockCrop(input: {
  sourceImageBuffer: Buffer;
  bbox: [number, number, number, number];
  sourceImageWidthPx: number;
  sourceImageHeightPx: number;
}) {
  const extractBox = getClampedExtractBox(input);

  if (!extractBox) {
    return null;
  }

  return sharp(input.sourceImageBuffer).extract(extractBox).png().toBuffer();
}

async function recognizeImageBlockText(input: {
  paddleOcrVlBaseUrl: string;
  sourceImageBuffer: Buffer;
  sourceImagePath: string;
  sourceImageWidthPx: number;
  sourceImageHeightPx: number;
  ocrRawJson: PaddleOcrVlJsonResult;
}): Promise<Map<number, string>> {
  const blocks = normalizePaddleOcrBlocks(
    input.ocrRawJson,
    input.sourceImageWidthPx,
    input.sourceImageHeightPx,
  );
  const imageBlocks = blocks.filter(
    (block) => normalizeOcrBlockLabel(block.block_label) === IMAGE_BLOCK_LABEL,
  );
  const textByExternalBlockId = new Map<number, string>();

  for (const block of imageBlocks) {
    const cropBuffer = await extractImageBlockCrop({
      sourceImageBuffer: input.sourceImageBuffer,
      bbox: block.block_bbox,
      sourceImageWidthPx: input.sourceImageWidthPx,
      sourceImageHeightPx: input.sourceImageHeightPx,
    });

    if (!cropBuffer) {
      textByExternalBlockId.set(block.block_id, "");
      continue;
    }

    const result = await runPaddleOcrTextImage({
      paddleOcrVlBaseUrl: input.paddleOcrVlBaseUrl,
      imageBuffer: cropBuffer,
      sourceImagePath: `${input.sourceImagePath}-block-${block.block_id}.png`,
    });

    textByExternalBlockId.set(block.block_id, result.text.trim());
  }

  return textByExternalBlockId;
}

function applyOcrBlockContentOverridesToRawJson(
  ocrRawJson: PaddleOcrVlJsonResult,
  blockContentOverrides: Map<number, string>,
): PaddleOcrVlJsonResult {
  if (blockContentOverrides.size === 0) {
    return ocrRawJson;
  }

  return {
    results: ocrRawJson.results.map((pageResult) => {
      const res = pageResult.res;

      if (typeof res !== "object" || res === null) {
        return pageResult;
      }

      const resRecord = res as Record<string, unknown>;
      const parsingResList = resRecord.parsing_res_list;

      if (!Array.isArray(parsingResList)) {
        return pageResult;
      }

      return {
        ...pageResult,
        res: {
          ...resRecord,
          parsing_res_list: parsingResList.map((entry) => {
            if (typeof entry !== "object" || entry === null) {
              return entry;
            }

            const entryRecord = entry as Record<string, unknown>;
            const blockContentOverride = blockContentOverrides.get(
              entryRecord.block_id as number,
            );

            if (blockContentOverride === undefined) {
              return entry;
            }

            return {
              ...entryRecord,
              block_content: blockContentOverride,
            };
          }),
        },
      };
    }),
  };
}

function createEmptyOcrResult(input: {
  widthPx: number;
  heightPx: number;
}): PaddleOcrVlJsonResult {
  return {
    results: [
      {
        res: {
          width: input.widthPx,
          height: input.heightPx,
          layout_det_res: {
            boxes: [],
            input_path: null,
            page_index: null,
          },
          parsing_res_list: [],
        },
      },
    ],
  };
}

function mapOcrX(value: number, transform: OcrImageTransform) {
  return clamp(
    transform.cropLeftPx +
      (value * transform.cropWidthPx) / transform.ocrWidthPx,
    0,
    transform.sourceWidthPx,
  );
}

function mapOcrY(value: number, transform: OcrImageTransform) {
  return clamp(
    transform.cropTopPx +
      (value * transform.cropHeightPx) / transform.ocrHeightPx,
    0,
    transform.sourceHeightPx,
  );
}

function mapOcrBoxCoordinates(
  value: unknown,
  transform: OcrImageTransform,
): unknown {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some((coordinate) => typeof coordinate !== "number")
  ) {
    return value;
  }

  return [
    mapOcrX(value[0] as number, transform),
    mapOcrY(value[1] as number, transform),
    mapOcrX(value[2] as number, transform),
    mapOcrY(value[3] as number, transform),
  ];
}

function normalizeOcrResultCoordinates(
  result: PaddleOcrVlJsonResult,
  transform: OcrImageTransform,
): PaddleOcrVlJsonResult {
  return {
    results: result.results.map((pageResult) => {
      const res = pageResult.res;

      if (typeof res !== "object" || res === null) {
        return pageResult;
      }

      const resRecord = res as Record<string, unknown>;
      const parsingResList = resRecord.parsing_res_list;
      const layoutDetRes = resRecord.layout_det_res;

      return {
        ...pageResult,
        res: {
          ...resRecord,
          width: transform.sourceWidthPx,
          height: transform.sourceHeightPx,
          parsing_res_list: Array.isArray(parsingResList)
            ? parsingResList.map((block) => {
                if (typeof block !== "object" || block === null) {
                  return block;
                }

                const blockRecord = block as Record<string, unknown>;

                return {
                  ...blockRecord,
                  block_bbox: mapOcrBoxCoordinates(
                    blockRecord.block_bbox,
                    transform,
                  ),
                };
              })
            : parsingResList,
          layout_det_res:
            typeof layoutDetRes === "object" && layoutDetRes !== null
              ? {
                  ...(layoutDetRes as Record<string, unknown>),
                  boxes: Array.isArray(
                    (layoutDetRes as Record<string, unknown>).boxes,
                  )
                    ? (
                        (layoutDetRes as Record<string, unknown>)
                          .boxes as unknown[]
                      ).map((box) => {
                        if (typeof box !== "object" || box === null) {
                          return box;
                        }

                        const boxRecord = box as Record<string, unknown>;

                        return {
                          ...boxRecord,
                          coordinate: mapOcrBoxCoordinates(
                            boxRecord.coordinate,
                            transform,
                          ),
                        };
                      })
                    : (layoutDetRes as Record<string, unknown>).boxes,
                }
              : layoutDetRes,
        },
      };
    }),
  };
}

function hasPageResults(result: unknown): result is PaddleOcrVlJsonResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "results" in result &&
    Array.isArray((result as { results?: unknown }).results) &&
    (result as { results: unknown[] }).results.length > 0
  );
}

@Injectable()
export class PaddleOcrClient {
  private readonly config = loadAppConfig();

  async run(
    sourceImagePath: string,
    metadata: PaddleOcrRunMetadata,
  ): Promise<unknown> {
    const endpoint = `${this.config.paddleOcrVlBaseUrl}/ocr/paddleocr-vl/page-image`;
    const sourceImageBuffer = await readFile(sourceImagePath);
    const normalizedImage = await normalizeImageForOcr({
      sourceImageBuffer,
      mimeType: metadata.mimeType,
      widthPx: metadata.widthPx,
      heightPx: metadata.heightPx,
    });

    if (!normalizedImage) {
      return createEmptyOcrResult({
        widthPx: metadata.widthPx,
        heightPx: metadata.heightPx,
      });
    }

    const contentFocusedImage = await focusImageOnDetectedTextContent({
      paddleOcrVlBaseUrl: this.config.paddleOcrVlBaseUrl,
      normalizedImage,
      sourceImagePath,
    });
    const formData = new FormData();

    formData.append(
      "file",
      new Blob([toBlobPart(contentFocusedImage.buffer)], {
        type: contentFocusedImage.mimeType,
      }),
      buildOcrUploadFilename(sourceImagePath, contentFocusedImage.mimeType),
    );

    let response: Response;

    try {
      response = await fetchPaddleOcr(endpoint, {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      const message = formatFetchError(error);

      throw new Error(
        `PaddleOCR-VL network request failed for ${endpoint}: ${message}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new Error(
        `PaddleOCR-VL request failed with ${response.status}: ${await response.text()}`,
      );
    }

    const result = await response.json();

    if (!hasPageResults(result)) {
      throw new Error("PaddleOCR-VL did not return page results.");
    }

    const normalizedOcrResult = normalizeOcrResultCoordinates(
      result,
      contentFocusedImage.transform,
    );
    const imageBlockTextByExternalBlockId = await recognizeImageBlockText({
      paddleOcrVlBaseUrl: this.config.paddleOcrVlBaseUrl,
      sourceImageBuffer,
      sourceImagePath,
      sourceImageWidthPx: metadata.widthPx,
      sourceImageHeightPx: metadata.heightPx,
      ocrRawJson: normalizedOcrResult,
    });

    return applyOcrBlockContentOverridesToRawJson(
      normalizedOcrResult,
      imageBlockTextByExternalBlockId,
    );
  }
}
