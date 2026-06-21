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
import { BookDetailTabs } from "@/features/books/components/book-detail-tabs";
import { BookFormDialog } from "@/features/books/components/book-form-dialog";
import { BookDocument } from "@/graphql/generated/graphql";
import { getBookRoute, getLibraryFolderRoute } from "@/lib/library-paths";

export function BookDetailRoute() {
  const { "*": path } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery(BookDocument, {
    variables: {
      path: path ?? "",
    },
    skip: !path,
  });

  if (!path) {
    return <ErrorState title="Book path is missing" />;
  }

  if (loading && !data) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (!data?.book) {
    return <ErrorState title="Book was not found" />;
  }

  const book = data.book;
  const folderPath = getContainingFolderPath(book.path);

  return (
    <section className="flex flex-col gap-6 pb-10">
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
                label: getBookDisplayName(book.path),
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
                  <DropdownMenuItem
                    onSelect={() => {
                      setIsEditDialogOpen(true);
                    }}
                  >
                    Edit Book
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <BookFormDialog
        book={book}
        open={isEditDialogOpen}
        trigger={null}
        onOpenChange={setIsEditDialogOpen}
        onCompleted={async (nextPath) => {
          if (nextPath && nextPath !== book.path) {
            navigate(getBookRoute(nextPath), { replace: true });
            return;
          }

          await refetch();
        }}
      />

      <BookDetailTabs
        book={book}
        onPageChanged={async () => {
          await refetch();
        }}
      />
    </section>
  );
}
