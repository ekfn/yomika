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
import { PageAiStatusDialog } from "@/features/pages/components/page-ai-status-dialog";
import { PageFormDialog } from "@/features/pages/components/page-form-dialog";
import { PageSiblingNav } from "@/features/pages/components/page-sibling-nav";
import { PageDetailTabs } from "@/features/pages/detail/page-detail-tabs";
import { PageDocument, type PageQuery } from "@/graphql/generated/graphql";
import {
  getBookRoute,
  getLibraryFolderRoute,
  getPageRoute,
} from "@/lib/library-paths";
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
  const visibleData = getVisiblePageData(data, previousData);
  const page = visibleData?.page ?? null;
  const isPageTransitioning = loading && Boolean(page);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAiStatusDialogOpen, setIsAiStatusDialogOpen] = useState(false);

  useEffect(() => {
    setSelectedBlockId(null);
    setIsEditDialogOpen(false);
    setIsAiStatusDialogOpen(false);
  }, [page?.path]);

  if (!path) {
    return <ErrorState title="Page path is missing" />;
  }

  if (loading && !page) {
    return <LoadingState />;
  }

  if (error || !page) {
    return <ErrorState message={error?.message ?? "Page was not found."} />;
  }

  const displayTitle = getPageDisplayTitle(page);
  const folderPath = getContainingFolderPath(page.path);
  const sourceImageUrl = page.sourceImageUrl;
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
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsEditDialogOpen(true);
                      }}
                    >
                      Edit Page
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsAiStatusDialogOpen(true);
                      }}
                    >
                      Edit status
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <PageFormDialog
          page={page}
          open={isEditDialogOpen}
          trigger={null}
          onOpenChange={setIsEditDialogOpen}
          onCompleted={async (nextPath) => {
            if (nextPath && nextPath !== page.path) {
              navigate(getPageRoute(nextPath), { replace: true });
              return;
            }

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
