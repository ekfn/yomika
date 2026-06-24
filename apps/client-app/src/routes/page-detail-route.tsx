import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@apollo/client/react";
import { LibraryBig, Folder, MoreHorizontal } from "lucide-react";
import {
  getBookDisplayName,
  getContainingFolderPath,
  getFolderAncestors,
} from "@yomika/shared";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageBreadcrumb } from "@/components/common/page-breadcrumb";
import {
  getPageDisplayTitle,
  getSourceImageDimensions,
} from "@/features/pages/detail/utils";
import { PageHeader } from "@/components/common/page-header";
import { RefreshButton } from "@/components/common/refresh-button";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { GuardedDropdownMenuItem } from "@/components/common/guarded-dropdown-menu-item";
import { PageAiStatusDialog } from "@/features/pages/components/page-ai-status-dialog";
import { PageOptionsDialog } from "@/features/pages/components/page-options-dialog";
import { PageRenameDialog } from "@/features/pages/components/page-rename-dialog";
import { PageSiblingNav } from "@/features/pages/components/page-sibling-nav";
import { PageDetailTabs } from "@/features/pages/detail/page-detail-tabs";
import { PageImageEditDialog } from "@/features/pages/image-editor/page-image-edit-dialog";
import {
  PageDocument,
  RunnerState,
  RunnerStatusDocument,
  type PageQuery,
} from "@/graphql/generated/graphql";
import {
  getBookRoute,
  getLibraryFolderRoute,
  getPageRoute,
} from "@/lib/library-paths";
import { appendMediaCacheBuster } from "@/lib/media-url";
import { cn } from "@/lib/utils";

const PAGE_DETAIL_CONTENT_CLASSES =
  "flex flex-col gap-6 pb-20 transition-opacity duration-150";
const PAGE_DETAIL_TRANSITIONING_CLASSES = "pointer-events-none opacity-60";

function getVisiblePageData(
  data: PageQuery | undefined,
  previousData: PageQuery | undefined,
) {
  return data ?? previousData;
}

export function PageDetailRoute() {
  const { "*": path } = useParams();
  const navigate = useNavigate();
  const { data, previousData, loading, error, refetch } = useQuery(
    PageDocument,
    {
      variables: {
        path: path ?? "",
      },
      skip: !path,
      notifyOnNetworkStatusChange: true,
    },
  );
  const runnerStatusQuery = useQuery(RunnerStatusDocument);
  const isRunnerRunning =
    runnerStatusQuery.data?.runnerStatus.state === RunnerState.Running;
  const visibleData = getVisiblePageData(data, previousData);
  const page = visibleData?.page ?? null;
  const isPageTransitioning = loading && Boolean(page);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isImageEditDialogOpen, setIsImageEditDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isAiStatusDialogOpen, setIsAiStatusDialogOpen] = useState(false);

  useEffect(() => {
    setSelectedBlockId(null);
    setIsImageEditDialogOpen(false);
    setIsRenameDialogOpen(false);
    setIsOptionsDialogOpen(false);
    setIsAiStatusDialogOpen(false);
  }, [page?.path]);

  if (!path) {
    return (
      <>
        <title>{`Page | Yomika`}</title>
        <ErrorState title="Page path is missing" />
      </>
    );
  }

  if (loading && !page) {
    return (
      <>
        <title>{`Page | Yomika`}</title>
        <LoadingState />
      </>
    );
  }

  if (error || !page) {
    return (
      <>
        <title>{`Page | Yomika`}</title>
        <ErrorState message={error?.message ?? "Page was not found."} />
      </>
    );
  }

  const displayTitle = getPageDisplayTitle(page);
  const documentDisplayTitle = page.bookPath
    ? `${getBookDisplayName(page.bookPath)} - ${displayTitle}`
    : displayTitle;
  const folderPath = getContainingFolderPath(page.path);
  const sourceImageUrl = appendMediaCacheBuster(
    page.sourceImageUrl,
    page.updatedAt,
  );
  const sourceImageDimensions = getSourceImageDimensions(page);
  const pageSiblingNavProps = page.bookPath
    ? {
        currentPageNumber: page.pageNumber ?? null,
        totalPageCount:
          page.bookPages.length > 0 ? page.bookPages.length : null,
        previousPage: page.previousPage ?? null,
        nextPage: page.nextPage ?? null,
        pages: page.bookPages,
      }
    : null;

  return (
    <section
      aria-busy={isPageTransitioning}
      className={cn(
        PAGE_DETAIL_CONTENT_CLASSES,
        isPageTransitioning ? PAGE_DETAIL_TRANSITIONING_CLASSES : null,
      )}
    >
      <title>{`${documentDisplayTitle} | Yomika`}</title>

      <div className="flex flex-col gap-3">
        <PageHeader
          className="mb-0"
          breadcrumbs={
            <PageBreadcrumb
              items={[
                {
                  label: "Library",
                  to: "/library",
                  icon: <Folder className="size-4" aria-hidden="true" />,
                  ariaLabel: "Library",
                },
                ...getFolderAncestors(folderPath).map((folder) => ({
                  label: folder.name,
                  to: getLibraryFolderRoute(folder.path),
                })),
                ...(page.bookPath
                  ? [
                      {
                        label: getBookDisplayName(page.bookPath),
                        to: getBookRoute(page.bookPath),
                        icon: (
                          <LibraryBig className="size-4" aria-hidden="true" />
                        ),
                      },
                    ]
                  : []),
                { label: displayTitle },
              ]}
            />
          }
          actions={
            <div className="flex flex-wrap gap-3">
              <RefreshButton onClick={() => void refetch()} loading={loading} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="More page actions"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuGroup>
                    {!page.bookPath ? (
                      <GuardedDropdownMenuItem
                        disabled={isRunnerRunning}
                        tooltip="Wait until the runner finishes or stop it before renaming items."
                        onSelect={() => {
                          setIsRenameDialogOpen(true);
                        }}
                      >
                        Rename Page
                      </GuardedDropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsOptionsDialogOpen(true);
                      }}
                    >
                      Edit Page Options
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsImageEditDialogOpen(true);
                      }}
                    >
                      Edit Page Image
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsAiStatusDialogOpen(true);
                      }}
                    >
                      Edit Page Status
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <PageImageEditDialog
          page={page}
          open={isImageEditDialogOpen}
          onOpenChange={setIsImageEditDialogOpen}
          onCompleted={async () => {
            await refetch();
          }}
        />

        <PageRenameDialog
          page={page}
          open={isRenameDialogOpen}
          trigger={null}
          onOpenChange={setIsRenameDialogOpen}
          onCompleted={async (nextPath) => {
            if (nextPath && nextPath !== page.path) {
              navigate(getPageRoute(nextPath), { replace: true });
              return;
            }

            await refetch();
          }}
        />
        <PageOptionsDialog
          page={page}
          open={isOptionsDialogOpen}
          trigger={null}
          onOpenChange={setIsOptionsDialogOpen}
          onCompleted={async () => {
            await refetch();
          }}
        />

        <PageAiStatusDialog
          page={page}
          open={isAiStatusDialogOpen}
          onOpenChange={setIsAiStatusDialogOpen}
          onCompleted={async () => {
            await refetch();
          }}
        />

        {pageSiblingNavProps ? (
          <PageSiblingNav {...pageSiblingNavProps} />
        ) : null}
      </div>

      <PageDetailTabs
        page={page}
        sourceImageUrl={sourceImageUrl}
        sourceImageDimensions={sourceImageDimensions}
        selectedBlockId={selectedBlockId}
        onSelectBlock={setSelectedBlockId}
      />
    </section>
  );
}
