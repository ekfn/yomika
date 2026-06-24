import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  FileTextIcon,
  FolderIcon,
  LibraryBigIcon,
  type LucideIcon,
} from "lucide-react";
import {
  getBookDisplayName,
  getContainingFolderPath,
  getFolderDisplayName,
  getLibraryPathParent,
  getPageDisplayName,
  normalizeLibraryPath,
} from "@yomika/shared";
import {
  FoldersDocument,
  MoveBookDocument,
  MoveFolderDocument,
  MovePageDocument,
} from "@/graphql/generated/graphql";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  FolderLocationStrip,
  getFolderLocationLabel,
  getLibraryLocationLabel,
} from "./folder-location-info";

const ROOT_TARGET_VALUE = "__library_root__";

type LibraryItemMoveKind = "folder" | "book" | "page";

type LibraryItemMoveDialogProps = {
  kind: LibraryItemMoveKind;
  path: string;
  open?: boolean;
  trigger?: ReactNode | null;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (input: {
    nextPath: string;
    previousParentPath: string | null;
    targetParentPath: string | null;
  }) => Promise<void> | void;
};

function getItemName(kind: LibraryItemMoveKind, path: string) {
  switch (kind) {
    case "folder":
      return getFolderDisplayName(path);
    case "book":
      return getBookDisplayName(path);
    case "page":
      return getPageDisplayName(path);
  }
}

function getDialogTitle(kind: LibraryItemMoveKind) {
  switch (kind) {
    case "folder":
      return "Move Folder";
    case "book":
      return "Move Book";
    case "page":
      return "Move Page";
  }
}

function getItemIcon(kind: LibraryItemMoveKind): {
  Icon: LucideIcon;
  className: string;
} {
  switch (kind) {
    case "folder":
      return {
        Icon: FolderIcon,
        className: "text-amber-600",
      };
    case "book":
      return {
        Icon: LibraryBigIcon,
        className: "text-sky-700",
      };
    case "page":
      return {
        Icon: FileTextIcon,
        className: "text-emerald-700",
      };
  }
}

function getCurrentParentPath(kind: LibraryItemMoveKind, path: string) {
  return kind === "folder"
    ? getLibraryPathParent(path)
    : getContainingFolderPath(path);
}

function getTargetValue(parentPath: string | null) {
  return parentPath ?? ROOT_TARGET_VALUE;
}

function getTargetParentPath(value: string) {
  return value === ROOT_TARGET_VALUE ? null : value;
}

function isSameOrDescendantPath(path: string, possibleAncestorPath: string) {
  const normalizedPath = normalizeLibraryPath(path);
  const normalizedPossibleAncestorPath =
    normalizeLibraryPath(possibleAncestorPath);

  return (
    normalizedPath === normalizedPossibleAncestorPath ||
    normalizedPath.startsWith(`${normalizedPossibleAncestorPath}/`)
  );
}

export function LibraryItemMoveDialog({
  kind,
  path,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: LibraryItemMoveDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  function handleOpenChange(nextOpen: boolean) {
    setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? <Button>Move</Button>}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <LibraryItemMoveContent
            kind={kind}
            path={path}
            onClose={() => handleOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LibraryItemMoveContent({
  kind,
  path,
  onClose,
  onCompleted,
}: {
  kind: LibraryItemMoveKind;
  path: string;
  onClose: () => void;
  onCompleted: LibraryItemMoveDialogProps["onCompleted"];
}) {
  const currentParentPath = getCurrentParentPath(kind, path);
  const [targetValue, setTargetValue] = useState(
    getTargetValue(currentParentPath),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const foldersQuery = useQuery(FoldersDocument);
  const [moveFolder, moveFolderState] = useMutation(MoveFolderDocument);
  const [moveBook, moveBookState] = useMutation(MoveBookDocument);
  const [movePage, movePageState] = useMutation(MovePageDocument);
  const moving =
    moveFolderState.loading || moveBookState.loading || movePageState.loading;
  const targetParentPath = getTargetParentPath(targetValue);
  const itemName = getItemName(kind, path);
  const currentLocationLabel = getFolderLocationLabel(currentParentPath);
  const itemIcon = getItemIcon(kind);
  const ItemIcon = itemIcon.Icon;
  const folderOptions = useMemo(
    () =>
      (foldersQuery.data?.folders ?? []).filter(
        (folder) =>
          kind !== "folder" || !isSameOrDescendantPath(folder.path, path),
      ),
    [foldersQuery.data?.folders, kind, path],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (targetParentPath === currentParentPath) {
      setFormError("Select a different destination.");
      return;
    }

    setFormError(null);

    try {
      let nextPath: string | null | undefined;

      if (kind === "folder") {
        const result = await moveFolder({
          variables: {
            path,
            input: {
              targetParentPath,
            },
          },
        });

        nextPath = result.data?.moveFolder.path;
      } else if (kind === "book") {
        const result = await moveBook({
          variables: {
            path,
            input: {
              targetParentPath,
            },
          },
        });

        nextPath = result.data?.moveBook.path;
      } else {
        const result = await movePage({
          variables: {
            path,
            input: {
              targetParentPath,
            },
          },
        });

        nextPath = result.data?.movePage.path;
      }

      if (!nextPath) {
        throw new Error("Move response did not include the new path.");
      }

      await onCompleted?.({
        nextPath,
        previousParentPath: currentParentPath,
        targetParentPath,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b px-4 py-4 pr-12">
        <DialogTitle>{getDialogTitle(kind)}</DialogTitle>
      </DialogHeader>
      {foldersQuery.loading ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="flex items-center gap-3 py-8 text-sm text-muted-foreground"
        >
          <Spinner className="shrink-0" />
          Loading folders
        </div>
      ) : foldersQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription>{foldersQuery.error.message}</AlertDescription>
        </Alert>
      ) : (
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <ItemIcon
                className={cn("size-4 shrink-0", itemIcon.className)}
                aria-hidden="true"
              />
              <div className="min-w-0 truncate text-sm font-medium text-stone-950">
                {itemName}
              </div>
            </div>
            <FolderLocationStrip
              className="mt-1"
              value={currentLocationLabel}
            />
          </div>
          <Field data-invalid={Boolean(formError)}>
            <FieldLabel htmlFor="library-move-target">Destination</FieldLabel>
            <Select
              value={targetValue}
              onValueChange={(value) => {
                setTargetValue(value);
                setFormError(null);
              }}
            >
              <SelectTrigger id="library-move-target" className="w-full">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_TARGET_VALUE}>Library</SelectItem>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder.path} value={folder.path}>
                    {getLibraryLocationLabel(
                      getFolderLocationLabel(folder.path),
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{formError}</FieldError>
          </Field>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={moving}>
              {moving ? "Moving" : "Move"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}
