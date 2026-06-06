import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import type { PageSegment } from "./types";

export type TextWithReadingRange = {
  endIndex: number;
  startIndex: number;
};

type TextWithReadingProps = Omit<ComponentProps<"span">, "children"> & {
  sourceText: string;
  text: string;
  textRange: TextWithReadingRange;
  textWithReading?: string | null;
  readingClassName?: string;
  sourceClassName?: string;
};

type CharacterEntry = {
  endIndex: number;
  startIndex: number;
  text: string;
};

type TextWithReadingAnnotation = TextWithReadingRange & {
  reading: string;
};

export type TextWithReadingAnnotationRange = TextWithReadingAnnotation & {
  text: string;
};

type TextWithReadingParseResult = {
  annotations: TextWithReadingAnnotation[];
  sourceText: string;
};

type TextWithReadingPart =
  | {
      text: string;
      type: "text";
    }
  | {
      reading: string;
      text: string;
      type: "reading";
    };

const FULLWIDTH_READING_START = "（";
const FULLWIDTH_READING_END = "）";
const KANJI_CHARACTER_REGEXP = /\p{Script=Han}/u;
const HIRAGANA_CHARACTER_REGEXP = /\p{Script=Hiragana}/u;
const KATAKANA_CHARACTER_REGEXP = /\p{Script=Katakana}/u;
const LATIN_CHARACTER_REGEXP = /\p{Script=Latin}/u;
const NUMBER_CHARACTER_REGEXP = /\p{Number}/u;
const LATIN_CONNECTOR_CHARACTERS = new Set([" ", "-", "'", "’"]);
const KATAKANA_MARKS = new Set(["ー", "・"]);

export function getSegmentTextWithReading(segment: PageSegment) {
  return segment.textWithReading ?? null;
}

function isKanjiCharacter(character: string) {
  return KANJI_CHARACTER_REGEXP.test(character);
}

function isHiraganaCharacter(character: string) {
  return HIRAGANA_CHARACTER_REGEXP.test(character);
}

function isKatakanaCharacter(character: string) {
  return (
    KATAKANA_CHARACTER_REGEXP.test(character) || KATAKANA_MARKS.has(character)
  );
}

function isLatinCharacter(character: string) {
  return LATIN_CHARACTER_REGEXP.test(character);
}

function isNumberCharacter(character: string) {
  return NUMBER_CHARACTER_REGEXP.test(character);
}

function getCharacterEntries(value: string): CharacterEntry[] {
  const entries: CharacterEntry[] = [];
  let cursor = 0;

  Array.from(value).forEach((character) => {
    const startIndex = cursor;

    cursor += character.length;
    entries.push({
      endIndex: cursor,
      startIndex,
      text: character,
    });
  });

  return entries;
}

function getLatinAnnotationStartIndex(entries: readonly CharacterEntry[]) {
  let entryIndex = entries.length - 1;

  while (entryIndex >= 0) {
    const character = entries[entryIndex]?.text;

    if (
      !character ||
      (!isLatinCharacter(character) &&
        !LATIN_CONNECTOR_CHARACTERS.has(character))
    ) {
      break;
    }

    entryIndex -= 1;
  }

  while (entryIndex + 1 < entries.length) {
    const character = entries[entryIndex + 1]?.text;

    if (!character || !LATIN_CONNECTOR_CHARACTERS.has(character)) {
      break;
    }

    entryIndex += 1;
  }

  return entries[entryIndex + 1]?.startIndex ?? null;
}

function getKanjiAnnotationStartIndex(entries: readonly CharacterEntry[]) {
  let entryIndex = entries.length - 1;

  while (entryIndex >= 0) {
    const character = entries[entryIndex]?.text;

    if (
      !character ||
      (!isKanjiCharacter(character) && !isNumberCharacter(character))
    ) {
      break;
    }

    entryIndex -= 1;
  }

  return entries[entryIndex + 1]?.startIndex ?? null;
}

function getHiraganaAnnotationStartIndex(entries: readonly CharacterEntry[]) {
  let entryIndex = entries.length - 1;

  while (entryIndex >= 0) {
    const character = entries[entryIndex]?.text;

    if (!character || !isHiraganaCharacter(character)) {
      break;
    }

    entryIndex -= 1;
  }

  while (entryIndex >= 0) {
    const character = entries[entryIndex]?.text;

    if (
      !character ||
      (!isKanjiCharacter(character) && !isNumberCharacter(character))
    ) {
      break;
    }

    entryIndex -= 1;
  }

  return entries[entryIndex + 1]?.startIndex ?? null;
}

function getKatakanaAnnotationStartIndex(entries: readonly CharacterEntry[]) {
  let entryIndex = entries.length - 1;

  while (entryIndex >= 0) {
    const character = entries[entryIndex]?.text;

    if (!character || !isKatakanaCharacter(character)) {
      break;
    }

    entryIndex -= 1;
  }

  return entries[entryIndex + 1]?.startIndex ?? null;
}

function getAnnotationStartIndex(sourceText: string) {
  const entries = getCharacterEntries(sourceText);
  const lastCharacter = entries[entries.length - 1]?.text;

  if (!lastCharacter) {
    return null;
  }

  if (isLatinCharacter(lastCharacter)) {
    return getLatinAnnotationStartIndex(entries);
  }

  if (isKanjiCharacter(lastCharacter)) {
    return getKanjiAnnotationStartIndex(entries);
  }

  if (isHiraganaCharacter(lastCharacter)) {
    return getHiraganaAnnotationStartIndex(entries);
  }

  if (isKatakanaCharacter(lastCharacter)) {
    return getKatakanaAnnotationStartIndex(entries);
  }

  if (isNumberCharacter(lastCharacter)) {
    return getKanjiAnnotationStartIndex(entries);
  }

  return null;
}

function parseTextWithReading(
  textWithReading: string | null | undefined,
): TextWithReadingParseResult | null {
  if (!textWithReading) {
    return null;
  }

  const annotations: TextWithReadingAnnotation[] = [];
  let sourceText = "";
  let cursor = 0;
  let lastAnnotationEndIndex = 0;

  while (cursor < textWithReading.length) {
    if (textWithReading[cursor] !== FULLWIDTH_READING_START) {
      sourceText += textWithReading[cursor];
      cursor += 1;
      continue;
    }

    const readingEndIndex = textWithReading.indexOf(
      FULLWIDTH_READING_END,
      cursor + FULLWIDTH_READING_START.length,
    );

    if (readingEndIndex === -1) {
      sourceText += textWithReading[cursor];
      cursor += 1;
      continue;
    }

    const detectedAnnotationStartIndex = getAnnotationStartIndex(sourceText);
    const annotationStartIndex =
      detectedAnnotationStartIndex === null
        ? null
        : Math.max(detectedAnnotationStartIndex, lastAnnotationEndIndex);
    const reading = textWithReading.slice(
      cursor + FULLWIDTH_READING_START.length,
      readingEndIndex,
    );

    if (
      annotationStartIndex !== null &&
      annotationStartIndex < sourceText.length
    ) {
      annotations.push({
        startIndex: annotationStartIndex,
        endIndex: sourceText.length,
        reading,
      });
      lastAnnotationEndIndex = sourceText.length;
    }

    cursor = readingEndIndex + FULLWIDTH_READING_END.length;
  }

  return {
    annotations,
    sourceText,
  };
}

export function getSourceTextFromTextWithReading(
  textWithReading: string | null | undefined,
) {
  return parseTextWithReading(textWithReading)?.sourceText ?? null;
}

export function getTextWithReadingAnnotations(
  sourceText: string,
  textWithReading: string | null | undefined,
): TextWithReadingAnnotationRange[] {
  const parsed = parseTextWithReading(textWithReading);

  if (!parsed || parsed.sourceText !== sourceText) {
    return [];
  }

  return parsed.annotations.map((annotation) => ({
    ...annotation,
    text: sourceText.slice(annotation.startIndex, annotation.endIndex),
  }));
}

function getTextWithReadingParts(
  sourceText: string,
  text: string,
  textRange: TextWithReadingRange,
  textWithReading: string | null | undefined,
): TextWithReadingPart[] {
  const fallbackText =
    sourceText.slice(textRange.startIndex, textRange.endIndex) || text;
  const parsed = parseTextWithReading(textWithReading);

  if (!parsed || parsed.sourceText !== sourceText) {
    return [
      {
        text: fallbackText,
        type: "text",
      },
    ];
  }

  const parts: TextWithReadingPart[] = [];
  let cursor = textRange.startIndex;

  parsed.annotations.forEach((annotation) => {
    if (
      annotation.startIndex < textRange.startIndex ||
      annotation.endIndex > textRange.endIndex ||
      annotation.startIndex < cursor ||
      annotation.endIndex <= cursor
    ) {
      return;
    }

    if (annotation.startIndex > cursor) {
      parts.push({
        text: sourceText.slice(cursor, annotation.startIndex),
        type: "text",
      });
    }

    parts.push({
      text: sourceText.slice(annotation.startIndex, annotation.endIndex),
      reading: annotation.reading,
      type: "reading",
    });

    cursor = annotation.endIndex;
  });

  if (cursor < textRange.endIndex) {
    parts.push({
      text: sourceText.slice(cursor, textRange.endIndex),
      type: "text",
    });
  }

  return parts.length > 0
    ? parts
    : [
        {
          text: fallbackText,
          type: "text",
        },
      ];
}

export function TextWithReading({
  className,
  readingClassName,
  sourceClassName,
  sourceText,
  text,
  textRange,
  textWithReading,
  ...props
}: TextWithReadingProps) {
  const parts = getTextWithReadingParts(
    sourceText,
    text,
    textRange,
    textWithReading,
  );

  return (
    <span className={cn("inline leading-none", className)} {...props}>
      {parts.map((part, partIndex) => {
        if (part.type === "text") {
          return (
            <span key={`text-${partIndex}`} className="align-baseline">
              {part.text}
            </span>
          );
        }

        return (
          <span
            key={`reading-${partIndex}`}
            className="inline-block min-w-[1em] text-center align-baseline leading-none"
          >
            <span
              className={cn(
                "mb-0.5 block whitespace-nowrap text-[0.58em] font-normal leading-none text-muted-foreground",
                readingClassName,
              )}
            >
              {part.reading}
            </span>
            <span className={cn("block leading-none", sourceClassName)}>
              {part.text}
            </span>
          </span>
        );
      })}
      {parts.length === 0 ? text : null}
    </span>
  );
}
