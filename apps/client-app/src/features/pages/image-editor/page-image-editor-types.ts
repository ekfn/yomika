export type PageImageEditorTool =
  | "marker"
  | "line"
  | "rectangle"
  | "filled-rectangle"
  | "select-move";

export type PageImageEditorStrokeColor =
  | "#dc2626"
  | "#2563eb"
  | "#16a34a"
  | "#f59e0b"
  | "#111827"
  | "#ffffff";

export type PageImageEditorShapeBase = {
  id: string;
  stroke: PageImageEditorStrokeColor;
  strokeWidth: number;
};

export type PageImageEditorMarkerShape = PageImageEditorShapeBase & {
  type: "marker";
  points: number[];
};

export type PageImageEditorLineShape = PageImageEditorShapeBase & {
  type: "line";
  points: [number, number, number, number];
};

export type PageImageEditorRectangleShape = PageImageEditorShapeBase & {
  type: "rectangle";
  fill: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageImageEditorSelectionShape = {
  id: string;
  type: "selection";
  image: HTMLImageElement;
  sourceX: number;
  sourceY: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageImageEditorShape =
  | PageImageEditorMarkerShape
  | PageImageEditorLineShape
  | PageImageEditorRectangleShape
  | PageImageEditorSelectionShape;

export type PageImageEditorExportHandle = {
  exportEditedImage: () => Promise<Blob>;
  hasEdits: boolean;
};
