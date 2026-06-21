export function appendMediaCacheBuster(
  url: string,
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}v=${encodeURIComponent(String(value))}`;
}
