export function getNameFromFileName(fileName: string): string {
  const trimmedFileName = fileName.trim();
  const name = trimmedFileName.replace(/\.[^./\\]+$/, "").trim();

  return name || trimmedFileName;
}
