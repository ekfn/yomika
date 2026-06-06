import type { AiCleanupInput } from "../../ai-processing-client";

export function buildCleanupPrompt(input: AiCleanupInput): string {
  const previousPageContextJson = JSON.stringify(
    input.context.previousPage,
    null,
    2,
  );
  const nextPageContextJson = JSON.stringify(input.context.nextPage, null, 2);
  const ocrBlocksJson = JSON.stringify(
    input.ocrBlocks.map((block) => ({
      id: block.id,
      label: block.label,
      content: block.content,
    })),
    null,
    2,
  );

  return `# OCR Block Cleanup

## Goal

Clean the target OCR page blocks.

Only target block \`content\` is editable. Use \`context.previousPage\` and
\`context.nextPage\` only as read-only context for text that crosses page
boundaries. Do not translate, summarize, modernize, or restyle the text.

## Workflow

1. Read target \`blocks\` in response order.
2. Decide the final \`content\` for every target block.
3. Return every target block \`id\` exactly once, including unchanged blocks and
   blocks whose final \`content\` is an empty string.
4. Return JSON only, matching the requested schema.

## Cleanup Rules

- Remove obvious extra furigana (prefer to keep kanji over extra furigana reading), duplicated readings, and OCR reading noise.
- Join OCR line-wrap newlines inside continuous prose. Add no spaces unless the original text requires one. Preserve line breaks that carry real structure.
- Normalize structural line markers when the block clearly contains structured items such as answer options, book parts, chapters, sections, exercises, contents entries, or similar numbered/lettered items. If an item starts with a standalone number or letter without punctuation, rewrite it as \`<marker>. <text>\`.
- Repair same-page split sentences by duplication. If a sentence is split across multiple target blocks, fully reconstruct that sentence and copy it into EVERY block that contains a fragment of it replacing the fragment; do not copy only part of the senteces; do not copy a whole neighboring block or unrelated sentences.
- Repair page-boundary sentence splits. If the target page starts mid-sentence, prepend only the missing beginning of that boundary sentence from \`context.previousPage\` to the relevant target block. If the target page ends mid-sentence, append only the missing ending of that boundary sentence from \`context.nextPage\`. Use only the adjacent unfinished sentence fragment, not the whole context block.
- Keep punctuation with the sentence it belongs to.
- Leave uncertain text unchanged. Do not invent missing text from outside the target/context OCR data.

## Data Boundaries

Keep these stable:

- target block count
- target block \`id\`
- response block order

Empty target \`content\` is valid when all text from that block was removed as
OCR noise.

## Page Context

- Page path: ${input.pagePath}
- Source languages: ${input.sourceLanguages.join(", ")}
- Target language for later translation: ${input.targetLanguage}

\`context.previousPage\` and \`context.nextPage\` contain only read-only \`label\`
and \`content\` context blocks. Empty arrays mean no usable neighboring page
context is available.

## Common Mistakes

- Omitting unchanged target blocks from the response.
- Editing fields other than \`content\`.
- Removing copied same-page text from the opposite block instead of duplicating it.

## Context

\`\`\`json
{
  "previousPage": ${previousPageContextJson},
  "nextPage": ${nextPageContextJson}
}
\`\`\`

## Input OCR Blocks

\`\`\`json
${ocrBlocksJson}
\`\`\``;
}
