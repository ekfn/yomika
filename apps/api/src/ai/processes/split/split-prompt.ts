import type { AiSplitInput } from "../../ai-processing-client";

export function buildSplitPrompt(input: AiSplitInput): string {
  const blocksJson = JSON.stringify(
    input.cleanupBlocks.map((block) => ({
      id: block.id,
      label: block.label,
      content: block.content,
    })),
    null,
    2,
  );

  return `# OCR Block Text Splitting

## Goal

Split the target page's OCR block content into meaningful source segments and
identify the source languages present in each segment.

The only output is a \`blocks\` array with an ordered \`segments\` array for each
target block. Do not translate, summarize, modernize, restyle, or rewrite the
text. This task is segmentation and language tagging, not cleanup.

## Workflow

1. Read page context and every item in \`blocks\`.
2. Split each block's own \`content\` into an ordered \`segments\` array.
3. Set \`languages\` to the language tags present in each segment.
4. Return every target block \`id\` exactly once, including blocks whose
   \`segments\` array is empty.
5. Return JSON only, matching the requested schema.

## Available Languages

Use only these language values in \`blocks[*].segments[*].languages\`:

| Value | Language |
| ----- | -------- |
| \`en\`  | English  |
| \`ja\`  | Japanese |
| \`zh\`  | Chinese  |
| \`ru\`  | Russian  |
| \`el\`  | Greek    |

## Splitting Rules

- Preserve text order. Do not drop, duplicate, translate, or paraphrase content.
- Return every target block exactly once, even when its \`segments\` array is
  empty.
- Split each block's own \`content\`; do not move segments between blocks.
- Preserve punctuation with the segment it belongs to.
- Prefer semantic boundaries over visual line breaks.
- Split ordinary prose by complete sentences when sentence boundaries are clear.
- Keep a short heading, caption, label, or standalone phrase as its own segment.
- Split answer choices into separate segments, including the option marker.
- Split list items, numbered items, table cells (separated by \\t), and dialogue turns separately.
- Preserve poetry or verse line breaks when the line break carries meaning.
- Keep tightly connected fragments together when splitting would make either side
  hard to understand.
- Tag each segment with all source languages actually present in the segment.
- Use \`languages: []\` only for a meaningful segment that should be preserved
  but contains no language-bearing text.
- If a block's \`content\` has no language-bearing text and is only whitespace,
  standalone numbers, punctuation, symbols, or OCR marks with no meaningful
  segment, submit \`"segments": []\` for that block.

## Page Context

- Page path: ${input.pagePath}
- Source languages: ${input.sourceLanguages.join(", ")}
- Target language for later translation: ${input.targetLanguage}

## Common Mistakes

- Splitting every OCR newline even when it is only a visual line wrap.
- Merging distinct answer choices or list items into one segment.
- Removing punctuation, option markers, brackets, or numbering.
- Cleaning OCR artifacts that should have been handled by OCR cleanup.
- Translating source text or adding explanatory text.
- Omitting a target block from the response.
- Moving a segment from one target block to another block.

## Input Blocks

\`\`\`json
${blocksJson}
\`\`\``;
}
