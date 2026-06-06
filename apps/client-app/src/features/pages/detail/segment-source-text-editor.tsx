import { useEffect, useState, type FormEvent } from "react";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useMutation } from "@apollo/client/react";
import { Button, Textarea } from "@/components/ui";
import { UpdatePageSegmentSourceTextDocument } from "@/graphql/generated/graphql";
import type { PageSegment } from "./types";

type SegmentSourceTextEditorProps = {
  blockId: string;
  pagePath: string;
  segment: PageSegment;
};

export function SegmentSourceTextEditor({
  blockId,
  pagePath,
  segment,
}: SegmentSourceTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(segment.sourceText);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updateSourceText, updateState] = useMutation(
    UpdatePageSegmentSourceTextDocument,
  );
  const isDirty = value !== segment.sourceText;

  useEffect(() => {
    if (!isEditing) {
      setValue(segment.sourceText);
      setErrorMessage(null);
    }
  }, [isEditing, segment.sourceText]);

  function handleEdit() {
    setValue(segment.sourceText);
    setErrorMessage(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setValue(segment.sourceText);
    setErrorMessage(null);
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await updateSourceText({
        variables: {
          path: pagePath,
          input: {
            blockId,
            segmentId: segment.id,
            sourceText: value,
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
            Text
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
        <span className="text-xs font-medium text-muted-foreground">Text</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Edit text"
          className="opacity-0 transition-opacity duration-150 group-hover/segment-field:opacity-100 group-focus-within/segment-field:opacity-100 motion-reduce:transition-none"
          onClick={handleEdit}
        >
          <PencilIcon />
        </Button>
      </div>
      {segment.sourceText.trim().length > 0 ? (
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">
          {segment.sourceText}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No text yet.</p>
      )}
    </div>
  );
}
