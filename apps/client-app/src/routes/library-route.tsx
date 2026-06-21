import { FolderIcon } from "lucide-react";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageBreadcrumb } from "@/components/common/page-breadcrumb";
import { PageHeader } from "@/components/common/page-header";
import { RefreshButton } from "@/components/common/refresh-button";
import { LibraryTree } from "@/features/library/components/library-tree";
import { useLibraryFolderContents } from "@/features/library/hooks/use-library-folder-contents";

export function LibraryRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetFolderPath = searchParams.get("folderPath");
  const {
    initialErrorMessage,
    isInitialLoading,
    libraryTreeData,
    loadingFolderPaths,
    loadFolderContents,
    refreshLoadedFolderContents,
  } = useLibraryFolderContents({ targetFolderPath });

  const handleRefresh = useCallback(async () => {
    await refreshLoadedFolderContents();
  }, [refreshLoadedFolderContents]);

  const handleContentChanged = useCallback(
    async (parentPath?: string | null) => {
      await refreshLoadedFolderContents(
        parentPath === undefined ? [] : [parentPath],
      );
    },
    [refreshLoadedFolderContents],
  );

  const handleFoldersChanged = useCallback(
    async (parentPath?: string | null) => {
      await refreshLoadedFolderContents(
        parentPath === undefined ? [] : [parentPath],
      );
    },
    [refreshLoadedFolderContents],
  );

  const handleTargetFolderOpened = useCallback(() => {
    setSearchParams(
      (currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);

        nextSearchParams.delete("folderPath");

        return nextSearchParams;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return (
    <section className="space-y-6">
      <title>{`Library | Yomika`}</title>

      <PageHeader
        breadcrumbs={
          <PageBreadcrumb
            items={[
              {
                label: "Library",
                to: "/library",
                icon: <FolderIcon className="size-4" aria-hidden="true" />,
                linkWhenCurrent: true,
              },
            ]}
          />
        }
        actions={<RefreshButton onRefresh={handleRefresh} />}
      />

      {isInitialLoading ? (
        <LoadingState />
      ) : initialErrorMessage ? (
        <ErrorState message={initialErrorMessage} />
      ) : (
        <LibraryTree
          books={libraryTreeData.books}
          folders={libraryTreeData.folders}
          pages={libraryTreeData.pages}
          loadingFolderPaths={loadingFolderPaths}
          targetFolderPath={targetFolderPath}
          onContentChanged={handleContentChanged}
          onFolderContentsRequested={loadFolderContents}
          onFoldersChanged={handleFoldersChanged}
          onTargetFolderOpened={handleTargetFolderOpened}
        />
      )}
    </section>
  );
}
