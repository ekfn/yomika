import { syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  LibraryBigIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getBookDisplayName,
  getContainingFolderPath,
  getFolderDisplayName,
  getLibraryPathParent,
  getPageDisplayName,
} from "@yomika/shared";
import { BookImportStatusBadge } from "@/components/common/status-badges";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TooltipProvider,
} from "@/components/ui";
import type {
  BookListFieldsFragment,
  FolderFieldsFragment,
  PageListFieldsFragment,
} from "@/graphql/generated/graphql";
import { getBookRoute, getPageRoute } from "@/lib/library-paths";
import { appendMediaCacheBuster } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import { BookFormDialog } from "@/features/books/components/book-form-dialog";
import { PageAiStatusDialog } from "@/features/pages/components/page-ai-status-dialog";
import { PageFormDialog } from "@/features/pages/components/page-form-dialog";
import { PageProcessingStatusBadges } from "@/features/pages/components/page-processing-status-badges";
import { PageImageEditDialog } from "@/features/pages/image-editor/page-image-edit-dialog";
import {
  AiProcessingDisabledBadge,
  VocabularyDisabledBadge,
} from "@/features/processing-settings/components/processing-disabled-badges";
import { FolderFormDialog } from "./folder-form-dialog";
import { getFolderLocationLabel } from "./folder-location-info";

const TREE_ROOT_ITEM_ID = "tree-root";
const LIBRARY_ROOT_ITEM_ID = "library-root";
const TREE_MOBILE_INDENT_PX = 12;
const TREE_DESKTOP_INDENT_PX = 24;
const TREE_ROW_START_PADDING_PX = 8;
const TREE_EXPAND_COLLAPSE_ANIMATION_MS = 160;
const TREE_NAVIGATION_SCROLL_DELAY_MS = 50;
const TREE_NAVIGATION_HIGHLIGHT_MS = 1000;
const TREE_MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const LIBRARY_TREE_BOOK_VIEW_PAGE_LIMIT = 20;

type TreeIndentStyle = CSSProperties & {
  "--ocr-library-tree-indent-desktop": string;
  "--ocr-library-tree-indent-mobile": string;
};

type LibraryTreeFolder = FolderFieldsFragment;
type LibraryTreeBook = BookListFieldsFragment & {
  pages?: readonly PageListFieldsFragment[];
};
type LibraryTreePage = PageListFieldsFragment;

type LibraryTreeItem =
  | {
      id: typeof TREE_ROOT_ITEM_ID;
      kind: "treeRoot";
      childrenIds: string[];
      name: string;
    }
  | {
      id: typeof LIBRARY_ROOT_ITEM_ID;
      kind: "root";
      childrenIds: string[];
      name: string;
    }
  | {
      id: string;
      kind: "folder";
      childrenIds: string[];
      folder: LibraryTreeFolder;
      name: string;
    }
  | {
      id: string;
      kind: "book";
      book: LibraryTreeBook;
      childrenIds: string[];
      name: string;
    }
  | {
      id: string;
      kind: "page";
      childrenIds: string[];
      name: string;
      page: LibraryTreePage;
    };

type LibraryTreeProps = {
  books: readonly LibraryTreeBook[];
  folders: readonly LibraryTreeFolder[];
  loadingFolderPaths?: readonly string[];
  pages: readonly LibraryTreePage[];
  targetFolderPath?: string | null;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
  onFolderContentsRequested?: (folderPath: string) => Promise<void> | void;
  onFoldersChanged: (parentPath?: string | null) => Promise<void> | void;
  onTargetFolderOpened?: () => void;
};

function getTreeIndentStyle(level: number): TreeIndentStyle {
  return {
    "--ocr-library-tree-indent-desktop": `${
      level * TREE_DESKTOP_INDENT_PX + TREE_ROW_START_PADDING_PX
    }px`,
    "--ocr-library-tree-indent-mobile": `${
      level * TREE_MOBILE_INDENT_PX + TREE_ROW_START_PADDING_PX
    }px`,
  };
}

function compareByName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getPageLeafTitle(page: LibraryTreePage) {
  return getPageDisplayName(page.path);
}

function comparePages(left: LibraryTreePage, right: LibraryTreePage) {
  const leftPageNumber = left.pageNumber ?? Number.POSITIVE_INFINITY;
  const rightPageNumber = right.pageNumber ?? Number.POSITIVE_INFINITY;

  if (leftPageNumber !== rightPageNumber) {
    return leftPageNumber - rightPageNumber;
  }

  return getPageLeafTitle(left).localeCompare(
    getPageLeafTitle(right),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function getBookProgressLabel(book: LibraryTreeBook) {
  if (book.sourcePageCount != null) {
    return `${book.importedPageCount}/${book.sourcePageCount} pages`;
  }

  return `${book.pageCount} pages`;
}

function buildLibraryTreeData(input: {
  books: readonly LibraryTreeBook[];
  folders: readonly LibraryTreeFolder[];
  pages: readonly LibraryTreePage[];
}) {
  const items = new Map<string, LibraryTreeItem>();
  const childIdsByParentId = new Map<string, string[]>();
  const addChild = (parentPath: string | null | undefined, childId: string) => {
    const resolvedParentId = parentPath
      ? `folder:${parentPath}`
      : LIBRARY_ROOT_ITEM_ID;
    const childIds = childIdsByParentId.get(resolvedParentId) ?? [];

    childIds.push(childId);
    childIdsByParentId.set(resolvedParentId, childIds);
  };

  const sortedFolders = [...input.folders]
    .map((folder) => ({
      folder,
      id: `folder:${folder.path}`,
      name: getFolderDisplayName(folder.path),
    }))
    .sort(compareByName);
  const sortedBooks = [...input.books]
    .map((book) => ({
      book,
      id: `book:${book.path}`,
      name: getBookDisplayName(book.path),
    }))
    .sort(compareByName);
  const sortedPages = [...input.pages].sort(comparePages);

  for (const { folder, id, name } of sortedFolders) {
    items.set(id, {
      id,
      kind: "folder",
      childrenIds: [],
      folder,
      name,
    });
    addChild(getLibraryPathParent(folder.path), id);
  }

  for (const { book, id, name } of sortedBooks) {
    items.set(id, {
      id,
      kind: "book",
      book,
      childrenIds: [],
      name,
    });
    addChild(getContainingFolderPath(book.path), id);
  }

  for (const page of sortedPages) {
    const id = `page:${page.path}`;
    const containingFolderPath = getContainingFolderPath(page.path);
    const parentItemId = page.bookPath
      ? `book:${page.bookPath}`
      : containingFolderPath
        ? `folder:${containingFolderPath}`
        : LIBRARY_ROOT_ITEM_ID;

    items.set(id, {
      id,
      kind: "page",
      childrenIds: [],
      name: getPageLeafTitle(page),
      page,
    });

    const childIds = childIdsByParentId.get(parentItemId) ?? [];

    childIds.push(id);
    childIdsByParentId.set(parentItemId, childIds);
  }

  for (const [parentItemId, childrenIds] of childIdsByParentId) {
    const parent = items.get(parentItemId);

    if (parent) {
      parent.childrenIds = childrenIds;
    }
  }

  const rootChildrenIds = childIdsByParentId.get(LIBRARY_ROOT_ITEM_ID) ?? [];

  items.set(LIBRARY_ROOT_ITEM_ID, {
    id: LIBRARY_ROOT_ITEM_ID,
    kind: "root",
    childrenIds: rootChildrenIds,
    name: "Library",
  });
  items.set(TREE_ROOT_ITEM_ID, {
    id: TREE_ROOT_ITEM_ID,
    kind: "treeRoot",
    childrenIds: [LIBRARY_ROOT_ITEM_ID],
    name: "Library",
  });

  return items;
}

function getTreeItemPath(item: LibraryTreeItem) {
  switch (item.kind) {
    case "book":
      return getBookRoute(item.book.path);
    case "page":
      return getPageRoute(item.page.path);
    case "folder":
    case "root":
    case "treeRoot":
      return "/library";
  }
}

function getLibraryTreePagePrimaryPath(input: {
  page: LibraryTreePage;
  bookSourcePageCount?: number | null | undefined;
}) {
  const { page, bookSourcePageCount } = input;
  const isMobile = window.matchMedia(TREE_MOBILE_MEDIA_QUERY).matches;

  if (
    isMobile ||
    !page.bookPath ||
    (bookSourcePageCount != null &&
      bookSourcePageCount > LIBRARY_TREE_BOOK_VIEW_PAGE_LIMIT)
  ) {
    return getPageRoute(page.path);
  }

  return `${getBookRoute(page.bookPath)}?pagePath=${encodeURIComponent(page.path)}`;
}

function getIsTreeItemMouseToggleOnly(itemData: LibraryTreeItem) {
  return (
    itemData.kind === "root" ||
    itemData.kind === "folder" ||
    itemData.kind === "book"
  );
}

function getTreeItemCanShowEmptyState(itemData: LibraryTreeItem) {
  return (
    itemData.kind === "root" ||
    itemData.kind === "folder" ||
    itemData.kind === "book"
  );
}

const LibraryTreeEmptyRow = memo(function LibraryTreeEmptyRow({
  level,
}: {
  level: number;
}) {
  const style = getTreeIndentStyle(level);

  return (
    <div
      aria-hidden="true"
      className="flex min-h-9 items-center py-1.5 pr-2 pl-[var(--ocr-library-tree-indent-mobile)] text-sm text-muted-foreground sm:pl-[var(--ocr-library-tree-indent-desktop)]"
      role="presentation"
      style={style}
    >
      <svg
        aria-hidden="true"
        className="mr-2 size-5 shrink-0 -translate-y-0.5 text-muted-foreground/55"
        fill="none"
        viewBox="0 0 20 20"
      >
        <path
          d="M6 2V8.5C6 11 8 13 10.5 13H16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      No content
    </div>
  );
});

const LibraryTreeLoadingRow = memo(function LibraryTreeLoadingRow({
  level,
}: {
  level: number;
}) {
  const style = getTreeIndentStyle(level);

  return (
    <div
      aria-hidden="true"
      className="flex min-h-9 items-center py-1.5 pr-2 pl-[var(--ocr-library-tree-indent-mobile)] text-sm text-muted-foreground sm:pl-[var(--ocr-library-tree-indent-desktop)]"
      role="presentation"
      style={style}
    >
      Loading...
    </div>
  );
});

function CreateBookMenuItem({ onSelect }: { onSelect: () => void }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <LibraryBigIcon aria-hidden="true" />
      Create book
    </DropdownMenuItem>
  );
}

function CreatePageMenuItem({ onSelect }: { onSelect: () => void }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <FileTextIcon aria-hidden="true" />
      Create page
    </DropdownMenuItem>
  );
}

function CreateFolderMenuItem({ onSelect }: { onSelect: () => void }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <FolderIcon aria-hidden="true" />
      Create folder
    </DropdownMenuItem>
  );
}

function LibraryTreeRootActions({
  onContentCreated,
  onContentChanged,
  onFoldersChanged,
}: {
  onContentCreated: (parentPath: string | null) => void;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
  onFoldersChanged: (parentPath?: string | null) => Promise<void> | void;
}) {
  const [isCreateBookOpen, setIsCreateBookOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  const handleMenuClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const handleContentCreated = async () => {
    await onContentChanged(null);
    onContentCreated(null);
  };

  const handleFolderCreated = async () => {
    await onFoldersChanged(null);
    onContentCreated(null);
  };

  return (
    <div className="shrink-0" onClick={handleMenuClick}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Library actions"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <CreateBookMenuItem
              onSelect={() => {
                setIsCreateBookOpen(true);
              }}
            />
            <CreatePageMenuItem
              onSelect={() => {
                setIsCreatePageOpen(true);
              }}
            />
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <CreateFolderMenuItem
              onSelect={() => {
                setIsCreateFolderOpen(true);
              }}
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BookFormDialog
        open={isCreateBookOpen}
        trigger={null}
        onCompleted={handleContentCreated}
        onOpenChange={setIsCreateBookOpen}
      />
      <PageFormDialog
        open={isCreatePageOpen}
        trigger={null}
        onCompleted={handleContentCreated}
        onOpenChange={setIsCreatePageOpen}
      />
      <FolderFormDialog
        open={isCreateFolderOpen}
        trigger={null}
        onCompleted={handleFolderCreated}
        onOpenChange={setIsCreateFolderOpen}
      />
    </div>
  );
}

const LibraryTreeRootRow = memo(function LibraryTreeRootRow({
  isExpanded,
  item,
  onContentCreated,
  onContentChanged,
  onFoldersChanged,
}: {
  isExpanded: boolean;
  item: Extract<LibraryTreeItem, { kind: "root" }>;
  onContentCreated: (parentPath: string | null) => void;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
  onFoldersChanged: (parentPath?: string | null) => Promise<void> | void;
}) {
  return (
    <>
      <ChevronRightIcon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform",
          isExpanded && "rotate-90",
        )}
        aria-hidden="true"
      />
      <FolderIcon
        className="size-4 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate font-medium text-stone-950">
        {item.name}
      </span>
      <LibraryTreeRootActions
        onContentCreated={onContentCreated}
        onContentChanged={onContentChanged}
        onFoldersChanged={onFoldersChanged}
      />
    </>
  );
});

function LibraryTreeFolderActions({
  folder,
  onContentCreated,
  onContentChanged,
  onFolderUpdated,
}: {
  folder: LibraryTreeFolder;
  onContentCreated: (parentPath: string | null) => void;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
  onFolderUpdated: (parentPath?: string | null) => Promise<void> | void;
}) {
  const [isCreateBookOpen, setIsCreateBookOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const folderName = getFolderDisplayName(folder.path);
  const folderLocationLabel = getFolderLocationLabel(folder.path);

  const handleMenuClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const handleContentCreated = async () => {
    await onContentChanged(folder.path);
    onContentCreated(folder.path);
  };

  const handleFolderCreated = async () => {
    await onFolderUpdated(folder.path);
    onContentCreated(folder.path);
  };

  return (
    <div className="shrink-0" onClick={handleMenuClick}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${folderName}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <CreateBookMenuItem
              onSelect={() => {
                setIsCreateBookOpen(true);
              }}
            />
            <CreatePageMenuItem
              onSelect={() => {
                setIsCreatePageOpen(true);
              }}
            />
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <CreateFolderMenuItem
              onSelect={() => {
                setIsCreateFolderOpen(true);
              }}
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BookFormDialog
        defaultParentPath={folder.path}
        defaultParentLabel={folderLocationLabel}
        open={isCreateBookOpen}
        trigger={null}
        onCompleted={handleContentCreated}
        onOpenChange={setIsCreateBookOpen}
      />
      <PageFormDialog
        defaultParentPath={folder.path}
        defaultParentLabel={folderLocationLabel}
        open={isCreatePageOpen}
        trigger={null}
        onCompleted={handleContentCreated}
        onOpenChange={setIsCreatePageOpen}
      />
      <FolderFormDialog
        open={isCreateFolderOpen}
        parentPath={folder.path}
        parentLabel={folderLocationLabel}
        trigger={null}
        onCompleted={handleFolderCreated}
        onOpenChange={setIsCreateFolderOpen}
      />
    </div>
  );
}

const LibraryTreeFolderRow = memo(function LibraryTreeFolderRow({
  item,
  isExpanded,
  onContentCreated,
  onContentChanged,
  onFolderUpdated,
}: {
  isExpanded: boolean;
  item: Extract<LibraryTreeItem, { kind: "folder" }>;
  onContentCreated: (parentPath: string | null) => void;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
  onFolderUpdated: (parentPath?: string | null) => Promise<void> | void;
}) {
  return (
    <>
      <ChevronRightIcon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform",
          isExpanded && "rotate-90",
        )}
        aria-hidden="true"
      />
      <FolderIcon
        className="size-4 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate font-medium text-stone-950">
        {item.name}
      </span>
      <LibraryTreeFolderActions
        folder={item.folder}
        onContentCreated={onContentCreated}
        onContentChanged={onContentChanged}
        onFolderUpdated={onFolderUpdated}
      />
    </>
  );
});

function LibraryTreeBookActions({
  book,
  onContentChanged,
}: {
  book: LibraryTreeBook;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const bookName = getBookDisplayName(book.path);
  const handleMenuClick = (event: MouseEvent) => {
    event.stopPropagation();
  };
  const handleCompleted = async (path?: string) => {
    await onContentChanged(getContainingFolderPath(path ?? book.path));
  };

  return (
    <div className="shrink-0" onClick={handleMenuClick}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${bookName}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link
                to={getBookRoute(book.path)}
                target="_blank"
                rel="noreferrer"
              >
                Open book
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsEditOpen(true);
              }}
            >
              Edit book
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BookFormDialog
        book={book}
        open={isEditOpen}
        trigger={null}
        onCompleted={handleCompleted}
        onOpenChange={setIsEditOpen}
      />
    </div>
  );
}

const LibraryTreeBookRow = memo(function LibraryTreeBookRow({
  isExpanded,
  item,
  onContentChanged,
}: {
  isExpanded: boolean;
  item: Extract<LibraryTreeItem, { kind: "book" }>;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
}) {
  const isImportComplete = item.book.importStatus === "COMPLETE";

  return (
    <>
      <ChevronRightIcon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform",
          isExpanded && "rotate-90",
        )}
        aria-hidden="true"
      />
      <LibraryBigIcon
        className="size-4 shrink-0 text-sky-700"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate font-medium text-stone-950">
        {item.name}
      </span>
      {!item.book.settings.vocabularyEnabled ? (
        <VocabularyDisabledBadge />
      ) : null}
      {!item.book.settings.aiProcessingEnabled ? (
        <AiProcessingDisabledBadge />
      ) : null}
      {isImportComplete ? (
        <Badge variant="outline">
          <FileTextIcon data-icon="inline-start" aria-hidden="true" />
          {item.book.pageCount}
        </Badge>
      ) : (
        <>
          <BookImportStatusBadge status={item.book.importStatus} />
          <span className="shrink-0 text-xs text-muted-foreground">
            {getBookProgressLabel(item.book)}
          </span>
        </>
      )}
      <LibraryTreeBookActions
        book={item.book}
        onContentChanged={onContentChanged}
      />
    </>
  );
});

function LibraryTreePageActions({
  onContentChanged,
  page,
  name,
}: {
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
  page: LibraryTreePage;
  name: string;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImageEditOpen, setIsImageEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const handleMenuClick = (event: MouseEvent) => {
    event.stopPropagation();
  };
  const handleCompleted = async (path?: string) => {
    await onContentChanged(getContainingFolderPath(path ?? page.path));
  };

  return (
    <div className="shrink-0" onClick={handleMenuClick}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${name}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link
                to={getPageRoute(page.path)}
                target="_blank"
                rel="noreferrer"
              >
                Open page
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsImageEditOpen(true);
              }}
            >
              Edit image
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsEditOpen(true);
              }}
            >
              Edit page
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsStatusOpen(true);
              }}
            >
              Edit status
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <PageImageEditDialog
        open={isImageEditOpen}
        pagePath={page.path}
        onCompleted={() => handleCompleted(page.path)}
        onOpenChange={setIsImageEditOpen}
      />
      <PageFormDialog
        open={isEditOpen}
        page={page}
        trigger={null}
        onCompleted={handleCompleted}
        onOpenChange={setIsEditOpen}
      />
      <PageAiStatusDialog
        open={isStatusOpen}
        page={page}
        onCompleted={() => handleCompleted(page.path)}
        onOpenChange={setIsStatusOpen}
      />
    </div>
  );
}

const LibraryTreePagePreview = memo(function LibraryTreePagePreview({
  page,
}: {
  page: LibraryTreePage;
}) {
  const sourcePreviewUrl = page.sourceImagePreviewUrl
    ? appendMediaCacheBuster(page.sourceImagePreviewUrl, page.updatedAt)
    : null;

  return (
    <span className="flex w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
      {sourcePreviewUrl ? (
        <img
          src={sourcePreviewUrl}
          alt=""
          loading="lazy"
          className="size-full object-contain"
        />
      ) : (
        <FileTextIcon
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </span>
  );
});

const LibraryTreePageRow = memo(function LibraryTreePageRow({
  item,
  onContentChanged,
}: {
  item: Extract<LibraryTreeItem, { kind: "page" }>;
  onContentChanged: (parentPath?: string | null) => Promise<void> | void;
}) {
  return (
    <>
      <LibraryTreePagePreview page={item.page} />
      <span className="min-w-0 flex-1 truncate font-medium text-stone-950">
        {item.name}
      </span>
      <PageProcessingStatusBadges
        className="hidden min-w-0 shrink items-center md:flex"
        ocrStatus={item.page.ocrStatus}
        aiProcessingStatus={item.page.aiProcessingStatus}
        aiProcessingEnabled={item.page.effectiveSettings.aiProcessingEnabled}
        vocabularyEnabled={item.page.effectiveSettings.vocabularyEnabled}
      />
      <LibraryTreePageActions
        onContentChanged={onContentChanged}
        page={item.page}
        name={item.name}
      />
    </>
  );
});

const LibraryTreeCollapsedBookFirstPageRow = memo(
  function LibraryTreeCollapsedBookFirstPageRow({
    level,
    pageItem,
    bookSourcePageCount,
    onContentChanged,
  }: {
    bookSourcePageCount?: number | null | undefined;
    level: number;
    pageItem: Extract<LibraryTreeItem, { kind: "page" }>;
    onContentChanged: (parentPath?: string | null) => Promise<void> | void;
  }) {
    const style = getTreeIndentStyle(level);
    const openPage = () => {
      window.open(
        getLibraryTreePagePrimaryPath({
          page: pageItem.page,
          bookSourcePageCount,
        }),
        "_blank",
        "noopener,noreferrer",
      );
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openPage();
    };

    return (
      <div
        role="link"
        tabIndex={0}
        style={style}
        className={cn(
          "group/tree-row flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-[var(--ocr-library-tree-indent-mobile)] text-left text-sm outline-none transition-colors sm:pl-[var(--ocr-library-tree-indent-desktop)]",
          "hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        onClick={openPage}
        onKeyDown={handleKeyDown}
      >
        <LibraryTreePageRow
          item={pageItem}
          onContentChanged={onContentChanged}
        />
      </div>
    );
  },
);

export function LibraryTree({
  books,
  folders,
  loadingFolderPaths = [],
  pages,
  targetFolderPath,
  onContentChanged,
  onFolderContentsRequested,
  onFoldersChanged,
  onTargetFolderOpened,
}: LibraryTreeProps) {
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<string[]>([
    TREE_ROOT_ITEM_ID,
    LIBRARY_ROOT_ITEM_ID,
  ]);
  const [expandingItems, setExpandingItems] = useState<string[]>([]);
  const [collapsingItems, setCollapsingItems] = useState<string[]>([]);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(
    null,
  );
  const animationTimeoutsRef = useRef(new Map<string, number>());
  const navigationTimeoutsRef = useRef<number[]>([]);
  const items = useMemo(
    () => buildLibraryTreeData({ books, folders, pages }),
    [books, folders, pages],
  );
  const expandedItemIds = useMemo(
    () => new Set(expandedItems),
    [expandedItems],
  );
  const expandingItemIds = useMemo(
    () => new Set(expandingItems),
    [expandingItems],
  );
  const collapsingItemIds = useMemo(
    () => new Set(collapsingItems),
    [collapsingItems],
  );
  const loadingFolderPathSet = useMemo(
    () => new Set(loadingFolderPaths),
    [loadingFolderPaths],
  );

  const clearNavigationTimeouts = () => {
    for (const timeoutId of navigationTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }

    navigationTimeoutsRef.current = [];
  };

  useEffect(() => {
    return () => {
      for (const timeoutId of animationTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }

      clearNavigationTimeouts();
    };
  }, []);

  useEffect(() => {
    setExpandedItems((currentExpandedItems) => [...currentExpandedItems]);
  }, [items]);

  const clearAnimationTimeout = (itemId: string) => {
    const timeoutId = animationTimeoutsRef.current.get(itemId);

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      animationTimeoutsRef.current.delete(itemId);
    }
  };

  const scheduleAnimationEnd = (itemId: string, onEnd: () => void) => {
    clearAnimationTimeout(itemId);

    const timeoutId = window.setTimeout(() => {
      animationTimeoutsRef.current.delete(itemId);
      onEnd();
    }, TREE_EXPAND_COLLAPSE_ANIMATION_MS);

    animationTimeoutsRef.current.set(itemId, timeoutId);
  };

  const getDescendantItemIds = (itemId: string) => {
    const descendantItemIds: string[] = [];
    const pendingItemIds = [...(items.get(itemId)?.childrenIds ?? [])];

    for (let index = 0; index < pendingItemIds.length; index += 1) {
      const descendantItemId = pendingItemIds[index]!;

      descendantItemIds.push(descendantItemId);
      pendingItemIds.push(...(items.get(descendantItemId)?.childrenIds ?? []));
    }

    return descendantItemIds;
  };

  const getFolderNavigationItemIds = (folderPath: string) => {
    const targetItemId = `folder:${folderPath}`;
    const targetItem = items.get(targetItemId);

    if (targetItem?.kind !== "folder") {
      return null;
    }

    const parentItemIds: string[] = [];
    const visitedItemIds = new Set<string>([targetItemId]);
    let currentItem = targetItem;

    let currentParentPath = getLibraryPathParent(currentItem.folder.path);

    while (currentParentPath) {
      const parentItemId = `folder:${currentParentPath}`;

      if (visitedItemIds.has(parentItemId)) {
        break;
      }

      visitedItemIds.add(parentItemId);

      const parentItem = items.get(parentItemId);

      if (parentItem?.kind !== "folder") {
        break;
      }

      parentItemIds.push(parentItemId);
      currentItem = parentItem;
      currentParentPath = getLibraryPathParent(currentItem.folder.path);
    }

    return [
      TREE_ROOT_ITEM_ID,
      LIBRARY_ROOT_ITEM_ID,
      ...parentItemIds.reverse(),
      targetItemId,
    ];
  };

  useEffect(() => {
    if (!targetFolderPath) {
      return;
    }

    const folderNavigationItemIds =
      getFolderNavigationItemIds(targetFolderPath);

    if (!folderNavigationItemIds) {
      return;
    }

    const targetItemId = folderNavigationItemIds.at(-1);

    if (!targetItemId) {
      return;
    }

    const folderNavigationItemIdSet = new Set(folderNavigationItemIds);

    clearNavigationTimeouts();
    setCollapsingItems((currentCollapsingItems) =>
      currentCollapsingItems.filter(
        (collapsingItemId) => !folderNavigationItemIdSet.has(collapsingItemId),
      ),
    );
    setExpandedItems((currentExpandedItems) => [
      ...new Set([...currentExpandedItems, ...folderNavigationItemIds]),
    ]);
    setHighlightedItemId(targetItemId);

    const scrollTimeoutId = window.setTimeout(() => {
      const targetElement = document.querySelector<HTMLElement>(
        `[data-ocr-library-tree-item-id="${targetItemId}"]`,
      );

      targetElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, TREE_NAVIGATION_SCROLL_DELAY_MS);
    const highlightTimeoutId = window.setTimeout(() => {
      setHighlightedItemId((currentHighlightedItemId) =>
        currentHighlightedItemId === targetItemId
          ? null
          : currentHighlightedItemId,
      );
    }, TREE_NAVIGATION_HIGHLIGHT_MS);

    navigationTimeoutsRef.current = [scrollTimeoutId, highlightTimeoutId];
    onTargetFolderOpened?.();
  }, [items, onTargetFolderOpened, targetFolderPath]);

  const handleContentCreated = (parentPath: string | null) => {
    const parentItemId = parentPath
      ? `folder:${parentPath}`
      : LIBRARY_ROOT_ITEM_ID;

    clearAnimationTimeout(parentItemId);
    setCollapsingItems((currentCollapsingItems) =>
      currentCollapsingItems.filter(
        (collapsingItemId) => collapsingItemId !== parentItemId,
      ),
    );
    setExpandedItems((currentExpandedItems) =>
      currentExpandedItems.includes(parentItemId)
        ? currentExpandedItems
        : [...currentExpandedItems, parentItemId],
    );
  };

  const toggleTreeItemExpanded = (itemId: string) => {
    if (collapsingItemIds.has(itemId)) {
      clearAnimationTimeout(itemId);
      setCollapsingItems((currentCollapsingItems) =>
        currentCollapsingItems.filter(
          (collapsingItemId) => collapsingItemId !== itemId,
        ),
      );
      setExpandingItems((currentExpandingItems) =>
        currentExpandingItems.includes(itemId)
          ? currentExpandingItems
          : [...currentExpandingItems, itemId],
      );
      scheduleAnimationEnd(itemId, () => {
        setExpandingItems((currentExpandingItems) =>
          currentExpandingItems.filter(
            (expandingItemId) => expandingItemId !== itemId,
          ),
        );
      });

      return;
    }

    if (expandedItemIds.has(itemId)) {
      const itemIdsToCollapse = [itemId, ...getDescendantItemIds(itemId)];
      const itemIdsToCollapseSet = new Set(itemIdsToCollapse);

      setCollapsingItems((currentCollapsingItems) =>
        currentCollapsingItems.includes(itemId)
          ? currentCollapsingItems
          : [...currentCollapsingItems, itemId],
      );
      setExpandingItems((currentExpandingItems) =>
        currentExpandingItems.filter(
          (expandingItemId) => expandingItemId !== itemId,
        ),
      );
      scheduleAnimationEnd(itemId, () => {
        setExpandedItems((currentExpandedItems) =>
          currentExpandedItems.filter(
            (expandedItemId) => !itemIdsToCollapseSet.has(expandedItemId),
          ),
        );
        setExpandingItems((currentExpandingItems) =>
          currentExpandingItems.filter(
            (expandingItemId) => !itemIdsToCollapseSet.has(expandingItemId),
          ),
        );
        setCollapsingItems((currentCollapsingItems) =>
          currentCollapsingItems.filter(
            (collapsingItemId) => !itemIdsToCollapseSet.has(collapsingItemId),
          ),
        );
      });

      return;
    }

    setExpandedItems((currentExpandedItems) =>
      currentExpandedItems.includes(itemId)
        ? currentExpandedItems
        : [...currentExpandedItems, itemId],
    );
    setExpandingItems((currentExpandingItems) =>
      currentExpandingItems.includes(itemId)
        ? currentExpandingItems
        : [...currentExpandingItems, itemId],
    );
    scheduleAnimationEnd(itemId, () => {
      setExpandingItems((currentExpandingItems) =>
        currentExpandingItems.filter(
          (expandingItemId) => expandingItemId !== itemId,
        ),
      );
    });
  };

  const handleTreeItemPrimaryAction = (itemData: LibraryTreeItem) => {
    if (itemData.kind === "root" || itemData.kind === "book") {
      toggleTreeItemExpanded(itemData.id);

      return;
    }

    if (itemData.kind === "folder") {
      void onFolderContentsRequested?.(itemData.folder.path);
      toggleTreeItemExpanded(itemData.id);

      return;
    }

    if (itemData.kind === "page") {
      const bookItem = itemData.page.bookPath
        ? items.get(`book:${itemData.page.bookPath}`)
        : null;
      const bookSourcePageCount =
        bookItem?.kind === "book" ? bookItem.book.sourcePageCount : null;

      window.open(
        getLibraryTreePagePrimaryPath({
          page: itemData.page,
          bookSourcePageCount,
        }),
        "_blank",
        "noopener,noreferrer",
      );

      return;
    }

    navigate(getTreeItemPath(itemData));
  };

  const tree = useTree<LibraryTreeItem>({
    rootItemId: TREE_ROOT_ITEM_ID,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => {
      const itemData = item.getItemData();

      return (
        itemData.kind === "treeRoot" ||
        itemData.kind === "root" ||
        itemData.kind === "folder" ||
        itemData.kind === "book" ||
        itemData.childrenIds.length > 0
      );
    },
    dataLoader: {
      getItem: (itemId) => {
        const item = items.get(itemId);

        if (!item) {
          throw new Error(`Library item ${itemId} was not found.`);
        }

        return item;
      },
      getChildren: (itemId) => items.get(itemId)?.childrenIds ?? [],
    },
    state: {
      expandedItems,
    },
    setExpandedItems,
    onPrimaryAction: (item) => {
      handleTreeItemPrimaryAction(item.getItemData());
    },
    features: [syncDataLoaderFeature],
  });

  const renderTreeItem = (
    item: ReturnType<typeof tree.getRootItem>,
  ): ReactNode => {
    const itemData = item.getItemData();
    const level = item.getItemMeta().level;
    const isCollapsing = collapsingItemIds.has(item.getId());
    const isExpanded = expandedItemIds.has(item.getId()) && !isCollapsing;
    const isExplicitlyFocused = tree.getState().focusedItem === item.getId();
    const isMouseToggleOnly = getIsTreeItemMouseToggleOnly(itemData);
    const itemProps = item.getProps();
    const childItems = item.getChildren();
    const bookFirstPageItem =
      itemData.kind === "book"
        ? childItems
            .map((childItem) => childItem.getItemData())
            .find(
              (
                childItemData,
              ): childItemData is Extract<LibraryTreeItem, { kind: "page" }> =>
                childItemData.kind === "page",
            )
        : undefined;
    const renderedChildItems =
      bookFirstPageItem && itemData.kind === "book"
        ? childItems.filter(
            (childItem) => childItem.getId() !== bookFirstPageItem.id,
          )
        : childItems;
    const canShowEmptyState = getTreeItemCanShowEmptyState(itemData);
    const isLoadingChildren =
      itemData.kind === "folder" &&
      loadingFolderPathSet.has(itemData.folder.path);
    const shouldShowEmptyState =
      !isLoadingChildren &&
      renderedChildItems.length === 0 &&
      canShowEmptyState;
    const shouldRenderChildren =
      (renderedChildItems.length > 0 ||
        shouldShowEmptyState ||
        isLoadingChildren) &&
      (expandedItemIds.has(item.getId()) ||
        collapsingItemIds.has(item.getId()));
    const handleItemClick = (event: MouseEvent<HTMLDivElement>) => {
      if (
        !(event.target instanceof Node) ||
        !event.currentTarget.contains(event.target)
      ) {
        return;
      }

      event.preventDefault();

      if (!isMouseToggleOnly) {
        item.setFocused();
        tree.updateDomFocus();
      }

      handleTreeItemPrimaryAction(itemData);
    };
    const handleItemMouseDown: MouseEventHandler<HTMLDivElement> = (event) => {
      if (
        !(event.target instanceof Node) ||
        !event.currentTarget.contains(event.target)
      ) {
        return;
      }

      itemProps.onMouseDown?.(event);

      if (isMouseToggleOnly) {
        event.preventDefault();
      }
    };
    const style = getTreeIndentStyle(level);

    return (
      <div key={item.getId()}>
        <div
          {...itemProps}
          data-ocr-library-tree-item-id={item.getId()}
          style={style}
          onClick={handleItemClick}
          onMouseDown={handleItemMouseDown}
          className={cn(
            "group/tree-row flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-[var(--ocr-library-tree-indent-mobile)] text-left text-sm outline-none transition-colors sm:pl-[var(--ocr-library-tree-indent-desktop)]",
            "hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:ring-2 focus-visible:ring-ring/50",
            isExplicitlyFocused && "bg-stone-100",
            highlightedItemId === item.getId() &&
              "animate-[ocr-library-tree-navigation-highlight_1000ms_ease-out] bg-amber-50/70 shadow-[0_0_0_1px_rgb(245_158_11_/_18%)]",
          )}
        >
          {itemData.kind === "root" ? (
            <LibraryTreeRootRow
              isExpanded={isExpanded}
              item={itemData}
              onContentCreated={handleContentCreated}
              onContentChanged={onContentChanged}
              onFoldersChanged={onFoldersChanged}
            />
          ) : itemData.kind === "folder" ? (
            <LibraryTreeFolderRow
              isExpanded={isExpanded}
              item={itemData}
              onContentCreated={handleContentCreated}
              onContentChanged={onContentChanged}
              onFolderUpdated={onFoldersChanged}
            />
          ) : itemData.kind === "book" ? (
            <LibraryTreeBookRow
              isExpanded={isExpanded}
              item={itemData}
              onContentChanged={onContentChanged}
            />
          ) : itemData.kind === "page" ? (
            <LibraryTreePageRow
              item={itemData}
              onContentChanged={onContentChanged}
            />
          ) : null}
        </div>
        {bookFirstPageItem ? (
          <LibraryTreeCollapsedBookFirstPageRow
            bookSourcePageCount={
              itemData.kind === "book" ? itemData.book.sourcePageCount : null
            }
            level={level + 1}
            pageItem={bookFirstPageItem}
            onContentChanged={onContentChanged}
          />
        ) : null}
        {shouldRenderChildren ? (
          <div
            className={cn(
              "overflow-hidden will-change-[opacity,transform]",
              isCollapsing
                ? "animate-[ocr-library-tree-group-collapse_160ms_ease-out_forwards]"
                : "opacity-100",
              expandingItemIds.has(item.getId()) &&
                "animate-[ocr-library-tree-group-expand_160ms_ease-out]",
            )}
          >
            <div className="overflow-hidden">
              {renderedChildItems.length > 0 ? (
                renderedChildItems.map((childItem) => renderTreeItem(childItem))
              ) : isLoadingChildren ? (
                <LibraryTreeLoadingRow level={level + 1} />
              ) : (
                <LibraryTreeEmptyRow level={level + 1} />
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div
        {...tree.getContainerProps("Library")}
        className="rounded-lg border border-border bg-white p-2 shadow-sm"
      >
        {tree
          .getRootItem()
          .getChildren()
          .map((item) => renderTreeItem(item))}
      </div>
    </TooltipProvider>
  );
}
