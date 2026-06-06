import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useMutation } from "@apollo/client/react";
import { Badge, Button, Textarea } from "@/components/ui";
import { UpdatePageSegmentTextWithReadingDocument } from "@/graphql/generated/graphql";
import { getSourceTextFromTextWithReading } from "./text-with-reading";
import type { PageSegment } from "./types";

type TextDiffPart = {
  text: string;
  type: "equal" | "extra" | "missing";
};

type TextWithReadingComparison = {
  sourceParts: TextDiffPart[];
  textWithReadingSourceParts: TextDiffPart[];
};

type TextWithReadingEditFormProps = {
  blockId: string;
  pagePath: string;
  segment: PageSegment;
  showCancel?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
};

export function hasSegmentTextWithReadingMismatch(segment: PageSegment) {
  if (!segment.textWithReading) {
    return false;
  }

  const textWithReadingSourceText =
    getSourceTextFromTextWithReading(segment.textWithReading) ?? "";

  return segment.sourceText !== textWithReadingSourceText;
}

export function TextWithReadingEditForm({
  blockId,
  pagePath,
  segment,
  showCancel = true,
  onCancel,
  onSaved,
}: TextWithReadingEditFormProps) {
  const [value, setValue] = useState(segment.textWithReading ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updateTextWithReading, updateState] = useMutation(
    UpdatePageSegmentTextWithReadingDocument,
  );
  const normalizedValue = value.length > 0 ? value : null;
  const currentValue = segment.textWithReading ?? null;
  const isDirty = normalizedValue !== currentValue;
  const textWithReadingSourceText = useMemo(
    () => getSourceTextFromTextWithReading(value) ?? "",
    [value],
  );
  const textComparison = useMemo(
    () =>
      getTextWithReadingComparison({
        sourceText: segment.sourceText,
        textWithReadingSourceText,
      }),
    [segment.sourceText, textWithReadingSourceText],
  );

  useEffect(() => {
    setValue(segment.textWithReading ?? "");
    setErrorMessage(null);
  }, [segment.textWithReading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await updateTextWithReading({
        variables: {
          path: pagePath,
          input: {
            blockId,
            segmentId: segment.id,
            textWithReading: normalizedValue,
          },
        },
      });
      onSaved?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <form className="flex flex-col gap-2" noValidate onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-2">
        <TextWithReadingHeader hasMismatch={Boolean(textComparison)} />
        <div className="flex items-center gap-1.5">
          {showCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={updateState.loading}
              onClick={onCancel}
            >
              <XIcon data-icon="inline-start" />
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || updateState.loading}
          >
            <CheckIcon data-icon="inline-start" />
            {updateState.loading ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
      <Textarea
        value={value}
        disabled={updateState.loading}
        className="min-h-24 bg-background text-sm"
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
      {textComparison ? (
        <TextWithReadingDiff comparison={textComparison} />
      ) : null}
      {errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </form>
  );
}

export function SegmentTextWithReadingEditor({
  blockId,
  pagePath,
  segment,
}: {
  blockId: string;
  pagePath: string;
  segment: PageSegment;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const hasMismatch = hasSegmentTextWithReadingMismatch(segment);

  function handleEdit() {
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <TextWithReadingEditForm
        blockId={blockId}
        pagePath={pagePath}
        segment={segment}
        onCancel={handleCancel}
        onSaved={() => {
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div className="group/segment-field flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <TextWithReadingHeader hasMismatch={hasMismatch} />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Edit text with reading"
          className="opacity-0 transition-opacity duration-150 group-hover/segment-field:opacity-100 group-focus-within/segment-field:opacity-100 motion-reduce:transition-none"
          onClick={handleEdit}
        >
          <PencilIcon />
        </Button>
      </div>
      {segment.textWithReading ? (
        <p className="whitespace-pre-wrap break-words text-sm">
          {segment.textWithReading}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No text with reading yet.
        </p>
      )}
    </div>
  );
}

function TextWithReadingHeader({ hasMismatch }: { hasMismatch: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Text with reading
      </span>
      {hasMismatch ? <Badge variant="warning">Mismatch</Badge> : null}
    </div>
  );
}

function TextWithReadingDiff({
  comparison,
}: {
  comparison: TextWithReadingComparison;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs">
      <p className="font-medium text-amber-950">Source text mismatch</p>
      <TextDiffRow label="Source" parts={comparison.sourceParts} />
      <TextDiffRow
        label="From text with reading"
        parts={comparison.textWithReadingSourceParts}
      />
    </div>
  );
}

function TextDiffRow({
  label,
  parts,
}: {
  label: string;
  parts: readonly TextDiffPart[];
}) {
  return (
    <div className="grid gap-1">
      <span className="font-medium text-amber-950/80">{label}</span>
      <p className="whitespace-pre-wrap break-words rounded bg-background/70 px-2 py-1.5 leading-relaxed text-foreground">
        {parts.length > 0 ? (
          parts.map((part, index) => (
            <span
              key={`${part.type}-${index}`}
              className={getDiffClassName(part)}
            >
              {part.text}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">empty</span>
        )}
      </p>
    </div>
  );
}

function getDiffClassName(part: TextDiffPart) {
  switch (part.type) {
    case "equal":
      return undefined;
    case "missing":
      return "rounded bg-red-100 text-red-950";
    case "extra":
      return "rounded bg-amber-200/80 text-amber-950";
  }
}

function getTextWithReadingComparison({
  sourceText,
  textWithReadingSourceText,
}: {
  sourceText: string;
  textWithReadingSourceText: string;
}): TextWithReadingComparison | null {
  if (sourceText === textWithReadingSourceText) {
    return null;
  }

  return buildTextDiffParts(sourceText, textWithReadingSourceText);
}

function buildTextDiffParts(
  sourceText: string,
  textWithReadingSourceText: string,
): TextWithReadingComparison {
  const sourceCharacters = Array.from(sourceText);
  const textWithReadingSourceCharacters = Array.from(textWithReadingSourceText);
  const columnCount = textWithReadingSourceCharacters.length + 1;
  const lcsLengths = Array.from(
    { length: (sourceCharacters.length + 1) * columnCount },
    () => 0,
  );

  for (
    let sourceIndex = sourceCharacters.length - 1;
    sourceIndex >= 0;
    sourceIndex -= 1
  ) {
    for (
      let textWithReadingSourceIndex =
        textWithReadingSourceCharacters.length - 1;
      textWithReadingSourceIndex >= 0;
      textWithReadingSourceIndex -= 1
    ) {
      const currentIndex =
        sourceIndex * columnCount + textWithReadingSourceIndex;
      const nextSourceIndex =
        (sourceIndex + 1) * columnCount + textWithReadingSourceIndex;
      const nextTextWithReadingSourceIndex =
        sourceIndex * columnCount + textWithReadingSourceIndex + 1;
      const nextBothIndex =
        (sourceIndex + 1) * columnCount + textWithReadingSourceIndex + 1;

      lcsLengths[currentIndex] =
        sourceCharacters[sourceIndex] ===
        textWithReadingSourceCharacters[textWithReadingSourceIndex]
          ? (lcsLengths[nextBothIndex] ?? 0) + 1
          : Math.max(
              lcsLengths[nextSourceIndex] ?? 0,
              lcsLengths[nextTextWithReadingSourceIndex] ?? 0,
            );
    }
  }

  const sourceParts: TextDiffPart[] = [];
  const textWithReadingSourceParts: TextDiffPart[] = [];
  let sourceIndex = 0;
  let textWithReadingSourceIndex = 0;

  while (
    sourceIndex < sourceCharacters.length ||
    textWithReadingSourceIndex < textWithReadingSourceCharacters.length
  ) {
    if (
      sourceIndex < sourceCharacters.length &&
      textWithReadingSourceIndex < textWithReadingSourceCharacters.length &&
      sourceCharacters[sourceIndex] ===
        textWithReadingSourceCharacters[textWithReadingSourceIndex]
    ) {
      pushTextDiffPart(sourceParts, {
        text: sourceCharacters[sourceIndex] ?? "",
        type: "equal",
      });
      pushTextDiffPart(textWithReadingSourceParts, {
        text: textWithReadingSourceCharacters[textWithReadingSourceIndex] ?? "",
        type: "equal",
      });
      sourceIndex += 1;
      textWithReadingSourceIndex += 1;
      continue;
    }

    const nextSourceLength =
      sourceIndex < sourceCharacters.length
        ? (lcsLengths[
            (sourceIndex + 1) * columnCount + textWithReadingSourceIndex
          ] ?? 0)
        : -1;
    const nextTextWithReadingSourceLength =
      textWithReadingSourceIndex < textWithReadingSourceCharacters.length
        ? (lcsLengths[
            sourceIndex * columnCount + textWithReadingSourceIndex + 1
          ] ?? 0)
        : -1;

    if (
      sourceIndex < sourceCharacters.length &&
      nextSourceLength >= nextTextWithReadingSourceLength
    ) {
      pushTextDiffPart(sourceParts, {
        text: sourceCharacters[sourceIndex] ?? "",
        type: "missing",
      });
      sourceIndex += 1;
      continue;
    }

    if (textWithReadingSourceIndex < textWithReadingSourceCharacters.length) {
      pushTextDiffPart(textWithReadingSourceParts, {
        text: textWithReadingSourceCharacters[textWithReadingSourceIndex] ?? "",
        type: "extra",
      });
      textWithReadingSourceIndex += 1;
    }
  }

  return {
    sourceParts,
    textWithReadingSourceParts,
  };
}

function pushTextDiffPart(parts: TextDiffPart[], part: TextDiffPart) {
  const previousPart = parts[parts.length - 1];

  if (previousPart?.type === part.type) {
    previousPart.text += part.text;
    return;
  }

  parts.push(part);
}
