import type { AiTranslateInput } from "../../ai-processing-client";

export function buildTranslationPrompt(input: AiTranslateInput): string {
  const segmentsJson = JSON.stringify(input.segments, null, 2);

  return `# Source Text Translation

## Goal

Provide each source text with inline readings and translate into \`${input.context.targetLanguage}\` language.

## Workflow

1. Read the \`segments\`.
2. Carefully add inline readings without changing the source text.
3. Translate every segment as part of the same page.
4. Return every target segment \`id\` exactly once.
5. Return JSON only, matching the requested schema.

## Rules

- Return every target segment exactly once.
- \`translation\` is the natural translation of the segment's whole \`text\` into \`${input.context.targetLanguage}\` language.
- Do not add comments or meta text into translation.
- Do not convert kana-only words into kanji. 
- \`textWithReading\` must preserve the whole segment \`text\` and add readings inline where useful; do not change the source text.
- For Japanese, keep kana and punctuation as in the source text, annotate kanji-containing chunks as \`漢字（かんじ）\`, and write readings in hiragana.
- Keep okurigana outside the annotation when it can be naturally separated: \`受（う）けました\`, \`授（さず）けてください\`, \`小（ちい）さな\`.
- Use full-width Japanese reading parentheses \`（\` and \`）\` in \`textWithReading\`.

## Example

input:
\`\`\`
{
  'id': '0.0',
  'text': '3個の荷物を受け取ってから、TomにOKメールを送りましたか。'
}
\`\`\`

ouput:
\`\`\`
{
  id: '0.0',
  text: '3個の荷物を受け取ってから、TomにOKメールを送りましたか。',
  textWithReading: '3個（こ）の荷物（にもつ）を受（う）け取（と）ってから、TomにOKメールを送（おく）りましたか。',
  translation: '...'
}
\`\`\`

## Common Mistakes

- Putting anything except the translation into \`translation\`.
- Using ASCII parentheses \`()\` instead of full-width parentheses \`（\` and \`）\`.
- \`textWithReading\` without readings does not match the source \`text\`.
- Converting kana to kanji while adding readings.

## Target Segments

\`\`\`json
${segmentsJson}
\`\`\``;
}
