import type Konva from "konva";

export async function exportPageImageEditorStage(input: {
  stage: Konva.Stage;
  scale: number;
}): Promise<Blob> {
  const dataUrl = input.stage.toDataURL({
    mimeType: "image/png",
    pixelRatio: 1 / input.scale,
  });
  const response = await fetch(dataUrl);

  return response.blob();
}

export function buildEditedPageImageFile(input: {
  blob: Blob;
  pageTitle: string;
}): File {
  const sanitizedTitle = input.pageTitle
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fileName = `${sanitizedTitle || "page"}-edited.png`;

  return new File([input.blob], fileName, { type: "image/png" });
}
