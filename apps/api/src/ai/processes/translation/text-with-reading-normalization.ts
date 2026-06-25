const FULLWIDTH_READING_OPEN = "（";
const FULLWIDTH_READING_CLOSE = "）";
const KANJI_CHARACTER_REGEXP = /\p{Script=Han}/u;
const HIRAGANA_CHARACTER_REGEXP = /\p{Script=Hiragana}/u;
const KATAKANA_CHARACTER_REGEXP = /\p{Script=Katakana}/u;
const LATIN_CHARACTER_REGEXP = /\p{Script=Latin}/u;
const NUMBER_CHARACTER_REGEXP = /\p{Number}/u;
const LATIN_CONNECTOR_CHARACTERS = new Set([" ", "-", "'", "’"]);
const KATAKANA_MARKS = new Set(["ー", "・"]);

type CharacterEntry = {
  endIndex: number;
  start: number;
  text: string;
};

type TextWithReadingAnnotation = {
  endIndex: number;
  reading: string;
  startIndex: number;
};

type TextWithReadingParseResult = {
  annotations: TextWithReadingAnnotation[];
  sourceText: string;
};

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
      start: startIndex,
      text: character,
    });
  });

  return entries;
}

function getCharacterAtIndex(value: string, index: number) {
  const codePoint = value.codePointAt(index);

  if (codePoint == null) {
    return null;
  }

  const length = codePoint > 0xffff ? 2 : 1;

  return value.slice(index, index + length);
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

  return entries[entryIndex + 1]?.start ?? null;
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

  return entries[entryIndex + 1]?.start ?? null;
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

  return entries[entryIndex + 1]?.start ?? null;
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

  return entries[entryIndex + 1]?.start ?? null;
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
  textWithReading: string,
): TextWithReadingParseResult {
  const annotations: TextWithReadingAnnotation[] = [];
  let sourceText = "";
  let cursor = 0;
  let lastAnnotationEndIndex = 0;

  while (cursor < textWithReading.length) {
    const character = getCharacterAtIndex(textWithReading, cursor);

    if (!character) {
      break;
    }

    if (character !== FULLWIDTH_READING_OPEN) {
      sourceText += character;
      cursor += character.length;
      continue;
    }

    const readingEndIndex = textWithReading.indexOf(
      FULLWIDTH_READING_CLOSE,
      cursor + FULLWIDTH_READING_OPEN.length,
    );

    if (readingEndIndex === -1) {
      sourceText += character;
      cursor += character.length;
      continue;
    }

    const detectedAnnotationStartIndex = getAnnotationStartIndex(sourceText);
    const annotationStartIndex =
      detectedAnnotationStartIndex === null
        ? null
        : Math.max(detectedAnnotationStartIndex, lastAnnotationEndIndex);
    const reading = textWithReading.slice(
      cursor + FULLWIDTH_READING_OPEN.length,
      readingEndIndex,
    );

    if (
      annotationStartIndex !== null &&
      annotationStartIndex < sourceText.length
    ) {
      annotations.push({
        endIndex: sourceText.length,
        reading,
        startIndex: annotationStartIndex,
      });
      lastAnnotationEndIndex = sourceText.length;
    }

    cursor = readingEndIndex + FULLWIDTH_READING_CLOSE.length;
  }

  return {
    annotations,
    sourceText,
  };
}

function buildLcsTable(left: readonly string[], right: readonly string[]) {
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      table[leftIndex]![rightIndex] =
        left[leftIndex] === right[rightIndex]
          ? table[leftIndex + 1]![rightIndex + 1]! + 1
          : Math.max(
              table[leftIndex + 1]![rightIndex]!,
              table[leftIndex]![rightIndex + 1]!,
            );
    }
  }

  return table;
}

function buildSurfaceToSourceIndexMap(
  sourceChars: readonly string[],
  surfaceChars: readonly string[],
) {
  const lcsTable = buildLcsTable(sourceChars, surfaceChars);
  const surfaceToSourceIndex = new Map<number, number>();
  let sourceIndex = 0;
  let surfaceIndex = 0;

  while (
    sourceIndex < sourceChars.length ||
    surfaceIndex < surfaceChars.length
  ) {
    if (
      sourceIndex < sourceChars.length &&
      surfaceIndex < surfaceChars.length &&
      sourceChars[sourceIndex] === surfaceChars[surfaceIndex]
    ) {
      surfaceToSourceIndex.set(surfaceIndex, sourceIndex);
      sourceIndex += 1;
      surfaceIndex += 1;
      continue;
    }

    if (
      surfaceIndex < surfaceChars.length &&
      (sourceIndex >= sourceChars.length ||
        lcsTable[sourceIndex]![surfaceIndex + 1]! >=
          lcsTable[sourceIndex + 1]![surfaceIndex]!)
    ) {
      surfaceIndex += 1;
      continue;
    }

    sourceIndex += 1;
  }

  return surfaceToSourceIndex;
}

function getEntryIndexByStart(
  entries: readonly CharacterEntry[],
  startIndex: number,
) {
  return entries.findIndex((entry) => entry.start === startIndex);
}

function getEntryIndexAfterEnd(
  entries: readonly CharacterEntry[],
  endIndex: number,
) {
  const entryIndex = entries.findIndex((entry) => entry.endIndex === endIndex);

  return entryIndex === -1 ? -1 : entryIndex + 1;
}

function getTransferredAnnotations(input: {
  sourceEntries: readonly CharacterEntry[];
  surfaceEntries: readonly CharacterEntry[];
  surfaceToSourceIndex: ReadonlyMap<number, number>;
  annotations: readonly TextWithReadingAnnotation[];
}) {
  const transferredAnnotations: TextWithReadingAnnotation[] = [];
  const occupiedSourceIndexes = new Set<number>();

  for (const annotation of input.annotations) {
    const surfaceStartIndex = getEntryIndexByStart(
      input.surfaceEntries,
      annotation.startIndex,
    );
    const surfaceEndIndex = getEntryIndexAfterEnd(
      input.surfaceEntries,
      annotation.endIndex,
    );

    if (
      surfaceStartIndex === -1 ||
      surfaceEndIndex === -1 ||
      surfaceStartIndex >= surfaceEndIndex
    ) {
      continue;
    }

    const sourceIndexes: number[] = [];

    for (
      let surfaceIndex = surfaceStartIndex;
      surfaceIndex < surfaceEndIndex;
      surfaceIndex += 1
    ) {
      const sourceIndex = input.surfaceToSourceIndex.get(surfaceIndex);

      if (sourceIndex === undefined) {
        sourceIndexes.length = 0;
        break;
      }

      sourceIndexes.push(sourceIndex);
    }

    if (sourceIndexes.length === 0) {
      continue;
    }

    const firstSourceIndex = sourceIndexes[0]!;
    const isContiguousSourceRange = sourceIndexes.every(
      (sourceIndex, index) => sourceIndex === firstSourceIndex + index,
    );

    if (!isContiguousSourceRange) {
      continue;
    }

    const sourceRange = input.sourceEntries.slice(
      firstSourceIndex,
      firstSourceIndex + sourceIndexes.length,
    );
    const surfaceRange = input.surfaceEntries.slice(
      surfaceStartIndex,
      surfaceEndIndex,
    );
    const sourceText = sourceRange.map((entry) => entry.text).join("");
    const surfaceText = surfaceRange.map((entry) => entry.text).join("");

    if (sourceText !== surfaceText) {
      continue;
    }

    if (
      sourceIndexes.some((sourceIndex) =>
        occupiedSourceIndexes.has(sourceIndex),
      )
    ) {
      continue;
    }

    sourceIndexes.forEach((sourceIndex) =>
      occupiedSourceIndexes.add(sourceIndex),
    );
    transferredAnnotations.push({
      endIndex: sourceRange[sourceRange.length - 1]!.endIndex,
      reading: annotation.reading,
      startIndex: sourceRange[0]!.start,
    });
  }

  return transferredAnnotations.sort(
    (left, right) => left.startIndex - right.startIndex,
  );
}

function buildTextWithReadingFromSource(input: {
  annotations: readonly TextWithReadingAnnotation[];
  sourceEntries: readonly CharacterEntry[];
}) {
  const annotationByEndIndex = new Map(
    input.annotations.map((annotation) => [annotation.endIndex, annotation]),
  );

  return input.sourceEntries
    .map((entry) => {
      const annotation = annotationByEndIndex.get(entry.endIndex);

      return annotation
        ? `${entry.text}${FULLWIDTH_READING_OPEN}${annotation.reading}${FULLWIDTH_READING_CLOSE}`
        : entry.text;
    })
    .join("");
}

export function normalizeTextWithReading(input: {
  sourceText: string;
  textWithReading: string;
}) {
  try {
    const parsed = parseTextWithReading(input.textWithReading);
    const sourceEntries = getCharacterEntries(input.sourceText);
    const surfaceEntries = getCharacterEntries(parsed.sourceText);
    const surfaceToSourceIndex = buildSurfaceToSourceIndexMap(
      sourceEntries.map((entry) => entry.text),
      surfaceEntries.map((entry) => entry.text),
    );

    return buildTextWithReadingFromSource({
      annotations: getTransferredAnnotations({
        annotations: parsed.annotations,
        sourceEntries,
        surfaceEntries,
        surfaceToSourceIndex,
      }),
      sourceEntries,
    });
  } catch {
    return input.sourceText;
  }
}
