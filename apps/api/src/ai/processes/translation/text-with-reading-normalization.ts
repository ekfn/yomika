const FULLWIDTH_READING_OPEN = "（";
const FULLWIDTH_READING_CLOSE = "）";
const PROTECTED_TEXT_CHAR_REGEXP = /^[\p{L}\p{N}]$/u;

type SurfaceToken = {
  char: string;
  start: number;
  end: number;
};

type DiffOperation =
  | {
      type: "equal";
    }
  | {
      type: "missingFromSurface";
      char: string;
    }
  | {
      type: "insertedInSurface";
      tokenIndex: number;
    };

type TextEdit = {
  start: number;
  end: number;
  replacement: string;
};

function getCodePointLength(text: string, index: number) {
  const codePoint = text.codePointAt(index);

  if (codePoint == null) {
    return 0;
  }

  return codePoint > 0xffff ? 2 : 1;
}

function getCodePointAt(text: string, index: number) {
  const length = getCodePointLength(text, index);

  return {
    char: text.slice(index, index + length),
    length,
  };
}

function getReadingAnnotationEndIndex(text: string, openIndex: number) {
  const closeIndex = text.indexOf(
    FULLWIDTH_READING_CLOSE,
    openIndex + FULLWIDTH_READING_OPEN.length,
  );

  if (closeIndex === -1) {
    return null;
  }

  return closeIndex + FULLWIDTH_READING_CLOSE.length;
}

function getSurfaceTokens(textWithReading: string): SurfaceToken[] {
  const tokens: SurfaceToken[] = [];
  let index = 0;

  while (index < textWithReading.length) {
    const { char, length } = getCodePointAt(textWithReading, index);

    if (length === 0) {
      break;
    }

    if (char === FULLWIDTH_READING_OPEN) {
      const readingAnnotationEndIndex = getReadingAnnotationEndIndex(
        textWithReading,
        index,
      );

      if (readingAnnotationEndIndex != null) {
        index = readingAnnotationEndIndex;
        continue;
      }
    }

    tokens.push({
      char,
      start: index,
      end: index + length,
    });
    index += length;
  }

  return tokens;
}

function isProtectedTextChar(char: string) {
  return PROTECTED_TEXT_CHAR_REGEXP.test(char);
}

function hasProtectedTextChar(chars: readonly string[]) {
  return chars.some((char) => isProtectedTextChar(char));
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

function diffSourceAndSurface(
  sourceChars: readonly string[],
  surfaceTokens: readonly SurfaceToken[],
): DiffOperation[] {
  const surfaceChars = surfaceTokens.map((token) => token.char);
  const lcsTable = buildLcsTable(sourceChars, surfaceChars);
  const operations: DiffOperation[] = [];
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
      operations.push({ type: "equal" });
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
      operations.push({
        type: "insertedInSurface",
        tokenIndex: surfaceIndex,
      });
      surfaceIndex += 1;
      continue;
    }

    operations.push({
      type: "missingFromSurface",
      char: sourceChars[sourceIndex]!,
    });
    sourceIndex += 1;
  }

  return operations;
}

function getInsertPosition(
  surfaceTokens: readonly SurfaceToken[],
  nextSurfaceTokenIndex: number | null,
) {
  if (
    nextSurfaceTokenIndex != null &&
    nextSurfaceTokenIndex < surfaceTokens.length
  ) {
    return surfaceTokens[nextSurfaceTokenIndex]!.start;
  }

  return surfaceTokens.at(-1)?.end ?? 0;
}

function createTextEditsFromDiff(
  sourceChars: readonly string[],
  surfaceTokens: readonly SurfaceToken[],
): TextEdit[] {
  const operations = diffSourceAndSurface(sourceChars, surfaceTokens);
  const edits: TextEdit[] = [];
  const pendingMissingSourceChars: string[] = [];
  const pendingInsertedSurfaceTokenIndexes: number[] = [];

  const flushPendingDiff = (nextSurfaceTokenIndex: number | null) => {
    if (
      pendingMissingSourceChars.length === 0 &&
      pendingInsertedSurfaceTokenIndexes.length === 0
    ) {
      return;
    }

    const insertedSurfaceChars = pendingInsertedSurfaceTokenIndexes.map(
      (tokenIndex) => surfaceTokens[tokenIndex]!.char,
    );

    if (
      hasProtectedTextChar(pendingMissingSourceChars) ||
      hasProtectedTextChar(insertedSurfaceChars)
    ) {
      pendingMissingSourceChars.length = 0;
      pendingInsertedSurfaceTokenIndexes.length = 0;
      return;
    }

    if (pendingInsertedSurfaceTokenIndexes.length > 0) {
      const firstInsertedToken =
        surfaceTokens[pendingInsertedSurfaceTokenIndexes[0]!]!;
      const lastInsertedTokenIndex =
        pendingInsertedSurfaceTokenIndexes[
          pendingInsertedSurfaceTokenIndexes.length - 1
        ]!;
      const lastInsertedToken = surfaceTokens[lastInsertedTokenIndex]!;

      edits.push({
        start: firstInsertedToken.start,
        end: lastInsertedToken.end,
        replacement: pendingMissingSourceChars.join(""),
      });
    } else {
      const insertPosition = getInsertPosition(
        surfaceTokens,
        nextSurfaceTokenIndex,
      );

      edits.push({
        start: insertPosition,
        end: insertPosition,
        replacement: pendingMissingSourceChars.join(""),
      });
    }

    pendingMissingSourceChars.length = 0;
    pendingInsertedSurfaceTokenIndexes.length = 0;
  };

  let nextSurfaceTokenIndex = 0;

  for (const operation of operations) {
    if (operation.type === "equal") {
      flushPendingDiff(nextSurfaceTokenIndex);
      nextSurfaceTokenIndex += 1;
      continue;
    }

    if (operation.type === "missingFromSurface") {
      pendingMissingSourceChars.push(operation.char);
      continue;
    }

    pendingInsertedSurfaceTokenIndexes.push(operation.tokenIndex);
    nextSurfaceTokenIndex = operation.tokenIndex + 1;
  }

  flushPendingDiff(null);

  return edits;
}

function applyTextEdits(text: string, edits: readonly TextEdit[]) {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (currentText, edit) =>
        `${currentText.slice(0, edit.start)}${edit.replacement}${currentText.slice(edit.end)}`,
      text,
    );
}

function getTextWithReadingSurface(textWithReading: string) {
  return getSurfaceTokens(textWithReading)
    .map((token) => token.char)
    .join("");
}

export function normalizeTextWithReading(input: {
  sourceText: string;
  textWithReading: string;
}) {
  try {
    if (getTextWithReadingSurface(input.textWithReading) === input.sourceText) {
      return input.textWithReading;
    }

    const edits = createTextEditsFromDiff(
      Array.from(input.sourceText),
      getSurfaceTokens(input.textWithReading),
    );

    return applyTextEdits(input.textWithReading, edits);
  } catch {
    return input.textWithReading;
  }
}
