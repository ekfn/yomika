import { getFolderAncestors } from "@yomika/shared";
import { FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const ROOT_FOLDER_LABEL = "Library root";

export function getLibraryLocationLabel(value?: string | null) {
  const folderLabel = value?.trim();

  return folderLabel && folderLabel !== ROOT_FOLDER_LABEL
    ? `Library / ${folderLabel}`
    : "Library";
}

export function FolderLocationStrip({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const locationLabel = getLibraryLocationLabel(value);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <FolderIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{locationLabel}</span>
    </div>
  );
}

export function getFolderLocationLabel(folderPath: string | null | undefined) {
  const label = getFolderAncestors(folderPath)
    .map((folder) => folder.name)
    .join(" / ");

  return label || ROOT_FOLDER_LABEL;
}
