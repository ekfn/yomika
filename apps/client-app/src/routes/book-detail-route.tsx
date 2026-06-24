import { useState } from "react";
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
import { BookDetailTabs } from "@/features/books/components/book-detail-tabs";
import { BookOptionsDialog } from "@/features/books/components/book-options-dialog";
import { BookRenameDialog } from "@/features/books/components/book-rename-dialog";
import {
  BookDocument,
  RunnerState,
  RunnerStatusDocument,
} from "@/graphql/generated/graphql";
import { getBookRoute, getLibraryFolderRoute } from "@/lib/library-paths";

export function BookDetailRoute() {
  const { "*": path } = useParams();
  const navigate = useNavigate();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery(BookDocument, {
    variables: {
      path: path ?? "",
    },
    skip: !path,
  });
  const runnerStatusQuery = useQuery(RunnerStatusDocument);
  const isRunnerRunning =
    runnerStatusQuery.data?.runnerStatus.state === RunnerState.Running;

  if (!path) {
    return (
      <>
        <title>{`Book | Yomika`}</title>
        <ErrorState title="Book path is missing" />
      </>
    );
  }

  if (loading && !data) {
    return (
      <>
        <title>{`Book | Yomika`}</title>
        <LoadingState />
      </>
    );
  }

  if (error) {
    return (
      <>
        <title>{`Book | Yomika`}</title>
        <ErrorState message={error.message} />
      </>
    );
  }

  if (!data?.book) {
    return (
      <>
        <title>{`Book | Yomika`}</title>
        <ErrorState title="Book was not found" />
      </>
    );
  }

  const book = data.book;
  const bookTitle = getBookDisplayName(book.path);
  const folderPath = getContainingFolderPath(book.path);

  return (
    <section className="flex flex-col gap-6 pb-10">
      <title>{`${bookTitle} | Yomika`}</title>

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
              {
                label: bookTitle,
                icon: <LibraryBig className="size-4" aria-hidden="true" />,
              },
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
                  aria-label="More book actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <GuardedDropdownMenuItem
                    disabled={isRunnerRunning}
                    tooltip="Wait until the runner finishes or stop it before renaming items."
                    onSelect={() => {
                      setIsRenameDialogOpen(true);
                    }}
                  >
                    Rename Book
                  </GuardedDropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setIsOptionsDialogOpen(true);
                    }}
                  >
                    Edit Book Options
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <BookRenameDialog
        book={book}
        open={isRenameDialogOpen}
        trigger={null}
        onOpenChange={setIsRenameDialogOpen}
        onCompleted={async (nextPath) => {
          if (nextPath && nextPath !== book.path) {
            navigate(getBookRoute(nextPath), { replace: true });
            return;
          }

          await refetch();
        }}
      />
      <BookOptionsDialog
        book={book}
        open={isOptionsDialogOpen}
        trigger={null}
        onOpenChange={setIsOptionsDialogOpen}
        onCompleted={async () => {
          await refetch();
        }}
      />

      <BookDetailTabs
        book={book}
        isRunnerRunning={isRunnerRunning}
        onPageChanged={async () => {
          await refetch();
        }}
      />
    </section>
  );
}
