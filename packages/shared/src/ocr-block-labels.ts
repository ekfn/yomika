export const OCR_BLOCK_LABELS = [
  "paragraph_title",
  "image",
  "text",
  "number",
  "abstract",
  "content",
  "figure_title",
  "formula",
  "table",
  "table_title",
  "reference",
  "doc_title",
  "footnote",
  "header",
  "algorithm",
  "footer",
  "seal",
  "chart_title",
  "chart",
  "formula_number",
  "header_image",
  "footer_image",
  "aside_text",
] as const;

export type OcrBlockLabel = (typeof OCR_BLOCK_LABELS)[number];

export const NON_TEXT_OCR_BLOCK_LABELS = [
  "number",
  "formula",
  "seal",
  "chart",
  "formula_number",
  "header_image",
  "footer_image",
] as const satisfies readonly OcrBlockLabel[];

export type NonTextOcrBlockLabel = (typeof NON_TEXT_OCR_BLOCK_LABELS)[number];

export type TextOcrBlockLabel = Exclude<OcrBlockLabel, NonTextOcrBlockLabel>;

export const TEXT_OCR_BLOCK_LABELS = [
  "paragraph_title",
  "image",
  "text",
  "abstract",
  "content",
  "figure_title",
  "table",
  "table_title",
  "reference",
  "doc_title",
  "footnote",
  "header",
  "algorithm",
  "footer",
  "chart_title",
  "aside_text",
] as const satisfies readonly TextOcrBlockLabel[];

const TEXT_OCR_BLOCK_LABEL_SET = new Set<string>([...TEXT_OCR_BLOCK_LABELS]);

export function normalizeOcrBlockLabel(
  blockLabel: string | null | undefined,
): string {
  return (blockLabel ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isTextOcrBlockLabel(
  blockLabel: string | null | undefined,
): boolean {
  return TEXT_OCR_BLOCK_LABEL_SET.has(normalizeOcrBlockLabel(blockLabel));
}
