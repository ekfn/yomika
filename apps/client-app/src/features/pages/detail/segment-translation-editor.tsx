import { useEffect, useState, type FormEvent } from "react";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useMutation } from "@apollo/client/react";
import { Button, Textarea } from "@/components/ui";
import { UpdatePageSegmentTranslationDocument } from "@/graphql/generated/graphql";
import type { PageSegment } from "./types";

type SegmentTranslationEditorProps = {
  blockId: string;
  pagePath: string;
  segment: PageSegment;
};

export function SegmentTranslationEditor({
  blockId,
  pagePath,
  segment,
}: SegmentTranslationEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(segment.translation ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updateTranslation, updateState] = useMutation(
    UpdatePageSegmentTranslationDocument,
  );
  const normalizedValue = value.length > 0 ? value : null;
  const currentValue = segment.translation ?? null;
  const isDirty = normalizedValue !== currentValue;

  useEffect(() => {
    if (!isEditing) {
      setValue(segment.translation ?? "");
      setErrorMessage(null);
    }
  }, [isEditing, segment.translation]);

  function handleEdit() {
    setValue(segment.translation ?? "");
    setErrorMessage(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setValue(segment.translation ?? "");
    setErrorMessage(null);
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await updateTranslation({
        variables: {
          path: pagePath,
          input: {
            blockId,
            segmentId: segment.id,
            translation: normalizedValue,
          },
        },
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  if (isEditing) {
    return (
      <form className="flex flex-col gap-2" noValidate onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Translation
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={updateState.loading}
              onClick={handleCancel}
            >
              <XIcon data-icon="inline-start" />
              Cancel
            </Button>
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
        {errorMessage ? (
          <p className="text-xs text-destructive">{errorMessage}</p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="group/segment-field flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Translation
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Edit translation"
          className="opacity-0 transition-opacity duration-150 group-hover/segment-field:opacity-100 group-focus-within/segment-field:opacity-100 motion-reduce:transition-none"
          onClick={handleEdit}
        >
          <PencilIcon />
        </Button>
      </div>
      {segment.translation?.trim() ? (
        <p className="whitespace-pre-wrap break-words text-sm">
          {segment.translation}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No translation yet.</p>
      )}
    </div>
  );
}
