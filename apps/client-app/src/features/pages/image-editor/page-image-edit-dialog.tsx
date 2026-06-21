import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { getPageDisplayName } from "@yomika/shared";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { uploadPageImage } from "@/features/uploads/api/upload-client";
import {
  OverwritePageSourceImageDocument,
  PageDocument,
  type PageContentFieldsFragment,
} from "@/graphql/generated/graphql";
import { appendMediaCacheBuster } from "@/lib/media-url";
import { PageImageEditor } from "./page-image-editor";
import { buildEditedPageImageFile } from "./page-image-editor-export";
import type { PageImageEditorExportHandle } from "./page-image-editor-types";

type PageImageEditDialogPage = Pick<
  PageContentFieldsFragment,
  | "path"
  | "sourceImageHeightPx"
  | "sourceImageUrl"
  | "sourceImageWidthPx"
  | "updatedAt"
>;

type PageImageEditDialogProps = {
  open: boolean;
  page?: PageImageEditDialogPage | null;
  pagePath?: string | null;
  onCompleted?: (path: string) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
};

export function PageImageEditDialog({
  open,
  page,
  pagePath,
  onCompleted,
  onOpenChange,
}: PageImageEditDialogProps) {
  const editorRef = useRef<PageImageEditorExportHandle | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasEdits, setHasEdits] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const shouldLoadPage = open && !page && Boolean(pagePath);
  const {
    data,
    loading: isPageLoading,
    error: pageError,
  } = useQuery(PageDocument, {
    variables: {
      path: pagePath ?? "",
    },
    skip: !shouldLoadPage,
  });
  const currentPage = page ?? data?.page ?? null;
  const imageWidthPx = currentPage?.sourceImageWidthPx ?? null;
  const imageHeightPx = currentPage?.sourceImageHeightPx ?? null;
  const displayTitle = currentPage
    ? getPageDisplayName(currentPage.path)
    : "Page";
  const imageUrl = useMemo(() => {
    if (!currentPage?.sourceImageUrl) {
      return null;
    }

    return appendMediaCacheBuster(
      currentPage.sourceImageUrl,
      currentPage.updatedAt,
    );
  }, [currentPage?.sourceImageUrl, currentPage?.updatedAt]);
  const [overwritePageSourceImage] = useMutation(
    OverwritePageSourceImageDocument,
  );

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setHasEdits(false);
    }
  }, [open, currentPage?.path, currentPage?.sourceImageUrl]);

  async function handleSave() {
    const editor = editorRef.current;

    if (!currentPage) {
      setErrorMessage("The page could not be loaded.");
      return;
    }

    if (!editor?.hasEdits) {
      setErrorMessage("Add at least one edit before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const blob = await editor.exportEditedImage();
      const file = buildEditedPageImageFile({
        blob,
        pageTitle: displayTitle,
      });
      const sourceUploadId = await uploadPageImage(file);
      const result = await overwritePageSourceImage({
        variables: {
          path: currentPage.path,
          input: {
            sourceUploadId,
          },
        },
      });
      const updatedPath =
        result.data?.overwritePageSourceImage.path ?? currentPage.path;

      onOpenChange(false);
      await onCompleted?.(updatedPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  const canEdit =
    Boolean(currentPage) &&
    Boolean(imageUrl) &&
    Boolean(imageWidthPx) &&
    Boolean(imageHeightPx);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Edit image</DialogTitle>
          <DialogDescription>
            Saving overwrites this page source image and resets processing.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0">
          {isPageLoading ? (
            <LoadingState />
          ) : pageError ? (
            <ErrorState message={pageError.message} />
          ) : !canEdit ||
            !currentPage ||
            !imageUrl ||
            !imageWidthPx ||
            !imageHeightPx ? (
            <ErrorState message="The app could not load this page source image." />
          ) : (
            <PageImageEditor
              ref={editorRef}
              disabled={isSaving}
              imageUrl={imageUrl}
              imageWidthPx={imageWidthPx}
              imageHeightPx={imageHeightPx}
              onError={setErrorMessage}
              onHasEditsChange={setHasEdits}
            />
          )}
        </div>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving || !canEdit || !hasEdits}
            onClick={handleSave}
          >
            {isSaving ? "Saving..." : "Save image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
