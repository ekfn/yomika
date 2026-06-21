const TEXT_OCR_BLOCK_LABELS = [
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
  "footer",
  "chart_title",
  "aside_text",
] as const;

const TEXT_OCR_BLOCK_LABEL_SET = new Set<string>([...TEXT_OCR_BLOCK_LABELS]);

function normalizeOcrBlockLabel(blockLabel: string | null | undefined): string {
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
