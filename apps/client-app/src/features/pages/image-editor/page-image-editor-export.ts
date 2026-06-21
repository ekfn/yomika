import Konva from "konva";
import type { PageImageEditorShape } from "./page-image-editor-types";

type NaturalImageRenderInput = {
  image: HTMLImageElement;
  imageHeightPx: number;
  imageWidthPx: number;
  shapes: readonly PageImageEditorShape[];
};

type ImageCropBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

function addShapeToLayer(layer: Konva.Layer, shape: PageImageEditorShape) {
  if (shape.type === "selection") {
    layer.add(
      new Konva.Rect({
        x: shape.sourceX,
        y: shape.sourceY,
        width: shape.width,
        height: shape.height,
        fill: "#ffffff",
      }),
    );
    layer.add(
      new Konva.Image({
        image: shape.image,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
      }),
    );
    return;
  }

  if (shape.type === "rectangle") {
    layer.add(
      new Konva.Rect({
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
        fill: shape.stroke,
        fillEnabled: shape.fill,
      }),
    );
    return;
  }

  layer.add(
    new Konva.Line({
      points: shape.points,
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      lineCap: "round",
      lineJoin: "round",
      tension: shape.type === "marker" ? 0.35 : 0,
    }),
  );
}

function createNaturalImageStage(input: NaturalImageRenderInput) {
  const container = document.createElement("div");

  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = `${input.imageWidthPx}px`;
  container.style.height = `${input.imageHeightPx}px`;
  document.body.appendChild(container);

  const stage = new Konva.Stage({
    container,
    width: input.imageWidthPx,
    height: input.imageHeightPx,
  });
  const layer = new Konva.Layer();

  stage.add(layer);
  layer.add(
    new Konva.Image({
      image: input.image,
      width: input.imageWidthPx,
      height: input.imageHeightPx,
    }),
  );

  input.shapes.forEach((shape) => addShapeToLayer(layer, shape));
  layer.draw();

  return { container, stage };
}

function getAlignedCropBounds(input: ImageCropBounds): ImageCropBounds {
  return {
    x: Math.max(0, Math.round(input.x)),
    y: Math.max(0, Math.round(input.y)),
    width: Math.max(1, Math.round(input.width)),
    height: Math.max(1, Math.round(input.height)),
  };
}

export function exportPageImageEditorSelectionDataUrl(
  input: NaturalImageRenderInput & { crop: ImageCropBounds },
): string {
  const { container, stage } = createNaturalImageStage(input);

  try {
    const crop = getAlignedCropBounds(input.crop);

    return stage.toDataURL({
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      mimeType: "image/png",
      pixelRatio: 1,
    });
  } finally {
    stage.destroy();
    container.remove();
  }
}

export async function exportPageImageEditorImage(
  input: NaturalImageRenderInput,
): Promise<Blob> {
  const { container, stage } = createNaturalImageStage(input);

  try {
    const dataUrl = stage.toDataURL({
      width: input.imageWidthPx,
      height: input.imageHeightPx,
      x: 0,
      y: 0,
      mimeType: "image/png",
      pixelRatio: 1,
    });
    const response = await fetch(dataUrl);

    return response.blob();
  } finally {
    stage.destroy();
    container.remove();
  }
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
