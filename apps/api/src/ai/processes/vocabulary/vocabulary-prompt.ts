import type { AiVocabularyInput } from "../../ai-processing-client";

export function buildVocabularyPrompt(input: AiVocabularyInput): string {
  const segmentsJson = JSON.stringify(input.segments, null, 2);

  return `# Source Vocabulary Extraction

## Goal

Extract useful source-language vocabulary entries for each segment and translate
each entry into ${input.targetLanguage}.

## Workflow

1. Read the \`segments\`.
2. For each segment, identify useful vocabulary items from \`textWithReading\`.
3. Use readings in \`textWithReading\` as context for selecting and formatting entries.
4. Return every target segment \`id\` exactly once.
5. Return JSON only, matching the requested schema.

## Rules

- Return every target segment exactly once.
- If a segment has no useful vocabulary items, return an empty \`vocabulary\` array for that segment.
- \`vocabulary[].text\` is the source word or short phrase.
- \`vocabulary[].translation\` is the natural translation of that word or phrase into ${input.targetLanguage}.
- Prefer meaningful vocabulary items over particles, punctuation, generic numbers, and trivial function words.
- Do not duplicate equivalent vocabulary items within the same segment.
- Do not invent words that are not present in \`textWithReading\`.
- For Japanese source text, keep readings inline where useful: \`漢字（かんじ）\`.
- Use full-width Japanese reading parentheses \`（\` and \`）\` in \`vocabulary[].text\`.

## Example

input:
\`\`\`json
{
  "id": "0.0",
  "textWithReading": "一寸法師（いっすんぼうし）は小（ちい）さな体（からだ）で旅（たび）に出（で）ました。"
}
\`\`\`

output:
\`\`\`json
{
  "segments": [
    {
      "id": "0.0",
      "vocabulary": [
        {
          "text": "一寸法師（いっすんぼうし）",
          "translation": "Иссумбоси"
        },
        {
          "text": "体（からだ）",
          "translation": "тело"
        },
        {
          "text": "旅（たび）に出（で）る",
          "translation": "отправляться в путешествие"
        }
      ]
    }
  ]
}
\`\`\`

## Common Mistakes

- Returning vocabulary for only some segment ids.
- Returning a single global vocabulary list instead of one list per segment.
- Translating the whole segment instead of individual words or short phrases.
- Using ASCII parentheses \`()\` instead of full-width parentheses \`（\` and \`）\`.
- Adding comments, explanations, or metadata into \`vocabulary[].translation\`.

## Source Languages

\`\`\`json
${JSON.stringify(input.sourceLanguages, null, 2)}
\`\`\`

## Target Segments

\`\`\`json
${segmentsJson}
\`\`\``;
}
