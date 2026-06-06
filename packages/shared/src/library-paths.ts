export const BOOK_DIRECTORY_PREFIX = "book.";
export const PAGE_DIRECTORY_PREFIX = "page.";

export type LibraryPathAncestor = {
  path: string;
  name: string;
};

export function normalizeLibraryPath(path: string): string {
  return path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

export function getLibraryPathBasename(path: string): string {
  const normalizedPath = normalizeLibraryPath(path);
  const parts = normalizedPath.split("/");

  return parts.at(-1) ?? "";
}

export function getLibraryPathParent(path: string): string | null {
  const normalizedPath = normalizeLibraryPath(path);
  const parts = normalizedPath.split("/");

  if (parts.length <= 1) {
    return null;
  }

  return parts.slice(0, -1).join("/");
}

export function isBookDirectoryName(name: string): boolean {
  return name.startsWith(BOOK_DIRECTORY_PREFIX);
}

export function isPageDirectoryName(name: string): boolean {
  return name.startsWith(PAGE_DIRECTORY_PREFIX);
}

export function isBookPath(path: string): boolean {
  return isBookDirectoryName(getLibraryPathBasename(path));
}

export function isPagePath(path: string): boolean {
  return isPageDirectoryName(getLibraryPathBasename(path));
}

export function stripBookDirectoryPrefix(name: string): string {
  return isBookDirectoryName(name)
    ? name.slice(BOOK_DIRECTORY_PREFIX.length)
    : name;
}

export function stripPageDirectoryPrefix(name: string): string {
  return isPageDirectoryName(name)
    ? name.slice(PAGE_DIRECTORY_PREFIX.length)
    : name;
}

export function getFolderDisplayName(path: string): string {
  return getLibraryPathBasename(path);
}

export function getBookDisplayName(path: string): string {
  return stripBookDirectoryPrefix(getLibraryPathBasename(path));
}

export function getPageDisplayName(path: string): string {
  return stripPageDirectoryPrefix(getLibraryPathBasename(path));
}

export function getPageBookPath(path: string): string | null {
  const parentPath = getLibraryPathParent(path);

  return parentPath && isBookPath(parentPath) ? parentPath : null;
}

export function getContainingFolderPath(path: string): string | null {
  const parentPath = getLibraryPathParent(path);

  if (!parentPath) {
    return null;
  }

  return isBookPath(parentPath) ? getLibraryPathParent(parentPath) : parentPath;
}

export function getFolderAncestors(
  path: string | null | undefined,
): LibraryPathAncestor[] {
  if (!path) {
    return [];
  }

  const ancestors: LibraryPathAncestor[] = [];
  const parts = normalizeLibraryPath(path).split("/").filter(Boolean);

  for (let index = 0; index < parts.length; index += 1) {
    const ancestorPath = parts.slice(0, index + 1).join("/");

    ancestors.push({
      path: ancestorPath,
      name: getFolderDisplayName(ancestorPath),
    });
  }

  return ancestors;
}

export function validatePlainDirectoryName(name: string): string | null {
  const normalizedName = name.trim();

  if (
    !normalizedName ||
    normalizedName === "." ||
    normalizedName === ".." ||
    normalizedName.includes("/") ||
    normalizedName.includes("\\") ||
    isBookDirectoryName(normalizedName) ||
    isPageDirectoryName(normalizedName)
  ) {
    return null;
  }

  return normalizedName;
}
