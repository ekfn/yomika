export function getBookRoute(path: string): string {
  return `/books/${encodeLibraryPathSegments(path)}`;
}

export function getPageRoute(path: string): string {
  return `/pages/${encodeLibraryPathSegments(path)}`;
}

export function getLibraryFolderRoute(path: string): string {
  return `/library?folderPath=${encodeURIComponent(path)}`;
}

function encodeLibraryPathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
