import { useApolloClient, useQuery } from "@apollo/client/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFolderAncestors } from "@yomika/shared";
import {
  LibraryFolderContentsBatchDocument,
  LibraryFolderContentsDocument,
  type LibraryFolderContentsFieldsFragment,
} from "@/graphql/generated/graphql";

type LoadedLibraryFolderContents = LibraryFolderContentsFieldsFragment;

const ROOT_PARENT_KEY = "__library_root__";

function getParentKey(parentPath: string | null) {
  return parentPath ?? ROOT_PARENT_KEY;
}

function getParentPathFromKey(parentKey: string) {
  return parentKey === ROOT_PARENT_KEY ? null : parentKey;
}

export function useLibraryFolderContents({
  targetFolderPath,
}: {
  targetFolderPath: string | null;
}) {
  const client = useApolloClient();
  const rootVariables = useMemo(() => ({ parentPath: null }), []);
  const folderContentsQuery = useQuery(LibraryFolderContentsDocument, {
    variables: rootVariables,
  });
  const [contentsByParentKey, setContentsByParentKey] = useState(
    () => new Map<string, LoadedLibraryFolderContents>(),
  );
  const [loadingParentKeys, setLoadingParentKeys] = useState<string[]>([]);
  const contentsByParentKeyRef = useRef(contentsByParentKey);
  const loadingParentKeysRef = useRef(new Set<string>());
  const isLoading = folderContentsQuery.loading;
  const errorMessage = folderContentsQuery.error?.message ?? null;
  const hasLoadedRootTreeData = Boolean(folderContentsQuery.data);
  const isInitialLoading = isLoading && !hasLoadedRootTreeData;
  const initialErrorMessage =
    errorMessage && !hasLoadedRootTreeData ? errorMessage : null;

  useEffect(() => {
    contentsByParentKeyRef.current = contentsByParentKey;
  }, [contentsByParentKey]);

  useEffect(() => {
    if (!folderContentsQuery.data) {
      return;
    }

    setContentsByParentKey((currentContentsByParentKey) => {
      const nextContentsByParentKey = new Map(currentContentsByParentKey);
      const contents = folderContentsQuery.data.libraryFolderContents;

      nextContentsByParentKey.set(
        getParentKey(contents.parentPath ?? null),
        contents,
      );

      return nextContentsByParentKey;
    });
  }, [folderContentsQuery.data]);

  const loadFolderContentsBatch = useCallback(
    async (
      parentPaths: readonly (string | null)[],
      options: { force?: boolean } = {},
    ): Promise<void> => {
      const requestedParentPaths = [
        ...new Set(parentPaths.map((parentPath) => parentPath ?? null)),
      ];
      const parentPathsToLoad = requestedParentPaths.filter((parentPath) => {
        const parentKey = getParentKey(parentPath);

        return (
          options.force ||
          (!contentsByParentKeyRef.current.has(parentKey) &&
            !loadingParentKeysRef.current.has(parentKey))
        );
      });

      if (parentPathsToLoad.length === 0) {
        return;
      }

      const parentKeysToLoad = parentPathsToLoad.map(getParentKey);

      for (const parentKey of parentKeysToLoad) {
        loadingParentKeysRef.current.add(parentKey);
      }

      setLoadingParentKeys([...loadingParentKeysRef.current]);

      try {
        const result = await client.query({
          query: LibraryFolderContentsBatchDocument,
          variables: {
            input: parentPathsToLoad.map((parentPath) => ({ parentPath })),
          },
          fetchPolicy: "network-only",
        });
        const contentsBatch = result.data?.libraryFolderContentsBatch;

        if (!contentsBatch) {
          throw new Error("Library folder contents batch response was empty.");
        }

        setContentsByParentKey((currentContentsByParentKey) => {
          const nextContentsByParentKey = new Map(currentContentsByParentKey);

          for (const contents of contentsBatch) {
            nextContentsByParentKey.set(
              getParentKey(contents.parentPath ?? null),
              contents,
            );
          }

          return nextContentsByParentKey;
        });
      } finally {
        for (const parentKey of parentKeysToLoad) {
          loadingParentKeysRef.current.delete(parentKey);
        }

        setLoadingParentKeys([...loadingParentKeysRef.current]);
      }
    },
    [client],
  );

  const loadFolderContents = useCallback(
    (
      parentPath: string | null,
      options: { force?: boolean } = {},
    ): Promise<void> => loadFolderContentsBatch([parentPath], options),
    [loadFolderContentsBatch],
  );

  useEffect(() => {
    if (!targetFolderPath) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      const folderPathsToLoad = getFolderAncestors(targetFolderPath).map(
        (folder) => folder.path,
      );

      if (isCancelled) {
        return;
      }

      await loadFolderContentsBatch(folderPathsToLoad);
    })();

    return () => {
      isCancelled = true;
    };
  }, [loadFolderContentsBatch, targetFolderPath]);

  const libraryTreeData = useMemo(() => {
    const loadedContents = [...contentsByParentKey.values()];
    const books = loadedContents.flatMap((contents) => [...contents.books]);
    const pages = loadedContents.flatMap((contents) => [
      ...contents.pages,
      ...contents.books.flatMap((book) => book.pages),
    ]);

    return {
      books,
      folders: loadedContents.flatMap((contents) => [...contents.folders]),
      pages,
    };
  }, [contentsByParentKey]);

  const loadingFolderPaths = useMemo(
    () =>
      loadingParentKeys
        .map(getParentPathFromKey)
        .filter((parentPath): parentPath is string => Boolean(parentPath)),
    [loadingParentKeys],
  );

  const refreshLoadedFolderContents = useCallback(
    async (extraParentPaths: readonly (string | null)[] = []) => {
      const parentKeys = [...contentsByParentKeyRef.current.keys()];
      const loadedParentPaths = parentKeys.length
        ? parentKeys.map(getParentPathFromKey)
        : [null];
      const parentPaths = [
        ...new Set(
          [...loadedParentPaths, ...extraParentPaths].map(
            (parentPath) => parentPath ?? null,
          ),
        ),
      ];

      await loadFolderContentsBatch(parentPaths, { force: true });
    },
    [loadFolderContentsBatch],
  );

  return {
    initialErrorMessage,
    isInitialLoading,
    libraryTreeData,
    loadingFolderPaths,
    loadFolderContents,
    refreshLoadedFolderContents,
  };
}
