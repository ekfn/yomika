const BOOK_DIRECTORY_PREFIX = "book.";
const PAGE_DIRECTORY_PREFIX = "page.";

function normalizeLibraryPath(path: string): string {
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

function isBookDirectoryName(name: string): boolean {
  return name.startsWith(BOOK_DIRECTORY_PREFIX);
}

function isPageDirectoryName(name: string): boolean {
  return name.startsWith(PAGE_DIRECTORY_PREFIX);
}

function stripBookDirectoryPrefix(name: string): string {
  return isBookDirectoryName(name)
    ? name.slice(BOOK_DIRECTORY_PREFIX.length)
    : name;
}

function stripPageDirectoryPrefix(name: string): string {
  return isPageDirectoryName(name)
    ? name.slice(PAGE_DIRECTORY_PREFIX.length)
    : name;
}

export function getBookDisplayName(path: string): string {
  return stripBookDirectoryPrefix(getLibraryPathBasename(path));
}

export function getPageDisplayName(path: string): string {
  return stripPageDirectoryPrefix(getLibraryPathBasename(path));
}

export function getFolderDisplayName(path: string): string {
  return getLibraryPathBasename(path);
}

export function isSameOrDescendantPath(
  path: string,
  possibleAncestorPath: string,
): boolean {
  const normalizedPath = normalizeLibraryPath(path);
  const normalizedPossibleAncestorPath =
    normalizeLibraryPath(possibleAncestorPath);

  return (
    normalizedPath === normalizedPossibleAncestorPath ||
    normalizedPath.startsWith(`${normalizedPossibleAncestorPath}/`)
  );
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
