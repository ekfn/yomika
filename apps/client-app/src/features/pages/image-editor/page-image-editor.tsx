import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  Fragment,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  MinusIcon,
  MousePointer2Icon,
  PencilIcon,
  Redo2Icon,
  SquareIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import {
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
} from "react-konva";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  exportPageImageEditorImage,
  exportPageImageEditorSelectionDataUrl,
} from "./page-image-editor-export";
import type {
  PageImageEditorExportHandle,
  PageImageEditorShape,
  PageImageEditorStrokeColor,
  PageImageEditorTool,
} from "./page-image-editor-types";

const STROKE_COLORS: PageImageEditorStrokeColor[] = [
  "#111827",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ffffff",
];

const STROKE_WIDTH_OPTIONS = [1, 2, 4, 8, 12, 16, 24, 32, 64, 128] as const;
const EDITOR_MAX_HEIGHT_PX = 640;

type PageImageEditorProps = {
  disabled?: boolean;
  imageHeightPx: number;
  imageUrl: string;
  imageWidthPx: number;
  onError?: (message: string) => void;
  onHasEditsChange?: (hasEdits: boolean) => void;
};

type LoadedImageState =
  | { status: "loading"; image: null; message: null }
  | { status: "loaded"; image: HTMLImageElement; message: null }
  | { status: "error"; image: null; message: string };

type PointerPosition = {
  x: number;
  y: number;
};

type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function createShapeId() {
  return crypto.randomUUID();
}

function normalizeRectangle(input: {
  id: string;
  start: PointerPosition;
  end: PointerPosition;
  fill: boolean;
  stroke: PageImageEditorStrokeColor;
  strokeWidth: number;
}): PageImageEditorShape {
  const x = Math.min(input.start.x, input.end.x);
  const y = Math.min(input.start.y, input.end.y);

  return {
    id: input.id,
    type: "rectangle",
    fill: input.fill,
    x,
    y,
    width: Math.abs(input.end.x - input.start.x),
    height: Math.abs(input.end.y - input.start.y),
    stroke: input.stroke,
    strokeWidth: input.strokeWidth,
  };
}

function normalizeSelectionBounds(input: {
  start: PointerPosition;
  end: PointerPosition;
}): SelectionBounds {
  const x = Math.min(input.start.x, input.end.x);
  const y = Math.min(input.start.y, input.end.y);

  return {
    x,
    y,
    width: Math.abs(input.end.x - input.start.x),
    height: Math.abs(input.end.y - input.start.y),
  };
}

function useLoadedImage(imageUrl: string): LoadedImageState {
  const [state, setState] = useState<LoadedImageState>({
    status: "loading",
    image: null,
    message: null,
  });

  useEffect(() => {
    let isActive = true;
    const image = new window.Image();

    setState({ status: "loading", image: null, message: null });

    image.onload = () => {
      if (!isActive) {
        return;
      }

      setState({ status: "loaded", image, message: null });
    };
    image.onerror = () => {
      if (!isActive) {
        return;
      }

      setState({
        status: "error",
        image: null,
        message: "The source image could not be loaded.",
      });
    };
    image.src = imageUrl;

    return () => {
      isActive = false;
    };
  }, [imageUrl]);

  return state;
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("The selected image fragment could not be loaded."));
    image.src = dataUrl;
  });
}

function useElementWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0);
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return { ref, width };
}

function getShapeEndDistance(shape: PageImageEditorShape) {
  if (shape.type === "marker") {
    return shape.points.length;
  }

  if (shape.type === "line") {
    const [x1, y1, x2, y2] = shape.points;

    return Math.hypot(x2 - x1, y2 - y1);
  }

  return Math.max(shape.width, shape.height);
}

function isPendingSelectionTarget(
  event: KonvaEventObject<MouseEvent | TouchEvent>,
  pendingSelectionId: string | null,
) {
  if (!pendingSelectionId) {
    return false;
  }

  return [event.target, ...event.target.getAncestors()].some(
    (node) =>
      node.name() === "selection-patch" && node.id() === pendingSelectionId,
  );
}

function ToolButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="icon-sm"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export const PageImageEditor = forwardRef<
  PageImageEditorExportHandle,
  PageImageEditorProps
>(function PageImageEditor(
  {
    disabled = false,
    imageHeightPx,
    imageUrl,
    imageWidthPx,
    onError,
    onHasEditsChange,
  },
  ref,
) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const isDrawingRef = useRef(false);
  const draftShapeRef = useRef<PageImageEditorShape | null>(null);
  const selectionDraftRef = useRef<SelectionBounds | null>(null);
  const shapeStartRef = useRef<PointerPosition | null>(null);
  const [tool, setTool] = useState<PageImageEditorTool>("rectangle");
  const [strokeColor, setStrokeColor] =
    useState<PageImageEditorStrokeColor>("#111827");
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [shapes, setShapes] = useState<PageImageEditorShape[]>([]);
  const [redoShapes, setRedoShapes] = useState<PageImageEditorShape[]>([]);
  const [draftShape, setDraftShape] = useState<PageImageEditorShape | null>(
    null,
  );
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(
    null,
  );
  const [selectionDraft, setSelectionDraft] = useState<SelectionBounds | null>(
    null,
  );
  const imageState = useLoadedImage(imageUrl);
  const { ref: containerRef, width: containerWidth } = useElementWidth();
  const scale = useMemo(() => {
    if (!containerWidth || !imageWidthPx || !imageHeightPx) {
      return 1;
    }

    return Math.min(
      1,
      containerWidth / imageWidthPx,
      EDITOR_MAX_HEIGHT_PX / imageHeightPx,
    );
  }, [containerWidth, imageHeightPx, imageWidthPx]);
  const stageWidth = Math.max(1, Math.round(imageWidthPx * scale));
  const stageHeight = Math.max(1, Math.round(imageHeightPx * scale));
  const visibleShapes = draftShape ? [...shapes, draftShape] : shapes;
  const hasEdits = shapes.length > 0;

  function updateDraftShape(nextDraftShape: PageImageEditorShape | null) {
    draftShapeRef.current = nextDraftShape;
    setDraftShape(nextDraftShape);
  }

  function updateSelectionDraft(nextSelectionDraft: SelectionBounds | null) {
    selectionDraftRef.current = nextSelectionDraft;
    setSelectionDraft(nextSelectionDraft);
  }

  function updateShapeStart(nextShapeStart: PointerPosition | null) {
    shapeStartRef.current = nextShapeStart;
  }

  function applyPendingSelection() {
    setPendingSelectionId(null);
  }

  useImperativeHandle(
    ref,
    () => ({
      hasEdits,
      exportEditedImage: async () => {
        if (imageState.status !== "loaded") {
          throw new Error("The image editor is not ready.");
        }

        const blob = await exportPageImageEditorImage({
          image: imageState.image,
          imageHeightPx,
          imageWidthPx,
          shapes,
        });

        applyPendingSelection();

        return blob;
      },
    }),
    [hasEdits, imageHeightPx, imageState, imageWidthPx, shapes],
  );

  useEffect(() => {
    if (imageState.status === "error") {
      onError?.(imageState.message);
    }
  }, [imageState.message, imageState.status, onError]);

  useEffect(() => {
    onHasEditsChange?.(hasEdits);
  }, [hasEdits, onHasEditsChange]);

  function getPointerPosition(): PointerPosition | null {
    const stage = stageRef.current;
    const pointerPosition = stage?.getPointerPosition();

    if (!stage || !pointerPosition) {
      return null;
    }

    return {
      x: Math.max(0, Math.min(imageWidthPx, pointerPosition.x / scale)),
      y: Math.max(0, Math.min(imageHeightPx, pointerPosition.y / scale)),
    };
  }

  function completeShape(shape: PageImageEditorShape | null) {
    if (!shape || getShapeEndDistance(shape) < 3) {
      updateDraftShape(null);
      updateShapeStart(null);
      return;
    }

    setShapes((current) => [...current, shape]);
    setRedoShapes([]);
    updateDraftShape(null);
    updateShapeStart(null);
  }

  async function completeSelection(bounds: SelectionBounds | null) {
    if (!bounds || Math.max(bounds.width, bounds.height) < 3) {
      updateSelectionDraft(null);
      updateShapeStart(null);
      return;
    }

    if (imageState.status !== "loaded") {
      updateSelectionDraft(null);
      updateShapeStart(null);
      return;
    }

    try {
      const dataUrl = exportPageImageEditorSelectionDataUrl({
        image: imageState.image,
        imageHeightPx,
        imageWidthPx,
        shapes,
        crop: bounds,
      });
      const image = await loadImageFromDataUrl(dataUrl);
      const selectionId = createShapeId();

      setShapes((current) => [
        ...current,
        {
          id: selectionId,
          type: "selection",
          image,
          sourceX: bounds.x,
          sourceY: bounds.y,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
      ]);
      setPendingSelectionId(selectionId);
      setRedoShapes([]);
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "The selected image fragment could not be moved.",
      );
    } finally {
      updateSelectionDraft(null);
      updateShapeStart(null);
    }
  }

  function clampSelectionPosition(
    shape: Extract<PageImageEditorShape, { type: "selection" }>,
    nextPosition: PointerPosition,
  ): PointerPosition {
    return {
      x: Math.max(0, Math.min(imageWidthPx - shape.width, nextPosition.x)),
      y: Math.max(0, Math.min(imageHeightPx - shape.height, nextPosition.y)),
    };
  }

  function updateSelectionShapePosition(
    shapeId: string,
    nextPosition: PointerPosition,
  ) {
    setShapes((current) =>
      current.map((shape) => {
        if (shape.type !== "selection" || shape.id !== shapeId) {
          return shape;
        }

        const clampedPosition = clampSelectionPosition(shape, nextPosition);

        return {
          ...shape,
          x: clampedPosition.x,
          y: clampedPosition.y,
        };
      }),
    );
    setRedoShapes([]);
  }

  function handleToolChange(nextTool: PageImageEditorTool) {
    applyPendingSelection();
    setTool(nextTool);
  }

  function handleDrawStart(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (disabled || imageState.status !== "loaded") {
      return;
    }

    if (isPendingSelectionTarget(event, pendingSelectionId)) {
      return;
    }

    applyPendingSelection();

    event.evt.preventDefault();
    const pointerPosition = getPointerPosition();

    if (!pointerPosition) {
      return;
    }

    isDrawingRef.current = true;
    updateShapeStart(pointerPosition);

    if (tool === "select-move") {
      updateSelectionDraft({
        x: pointerPosition.x,
        y: pointerPosition.y,
        width: 0,
        height: 0,
      });
      return;
    }

    if (tool === "marker") {
      updateDraftShape({
        id: createShapeId(),
        type: "marker",
        points: [pointerPosition.x, pointerPosition.y],
        stroke: strokeColor,
        strokeWidth,
      });
      return;
    }

    if (tool === "line") {
      updateDraftShape({
        id: createShapeId(),
        type: "line",
        points: [
          pointerPosition.x,
          pointerPosition.y,
          pointerPosition.x,
          pointerPosition.y,
        ],
        stroke: strokeColor,
        strokeWidth,
      });
      return;
    }

    updateDraftShape(
      normalizeRectangle({
        id: createShapeId(),
        start: pointerPosition,
        end: pointerPosition,
        fill: tool === "filled-rectangle",
        stroke: strokeColor,
        strokeWidth,
      }),
    );
  }

  function handleDrawMove(event: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!isDrawingRef.current) {
      return;
    }

    event.evt.preventDefault();
    const pointerPosition = getPointerPosition();

    if (!pointerPosition) {
      return;
    }

    if (tool === "select-move") {
      const currentShapeStart = shapeStartRef.current;

      if (!currentShapeStart) {
        return;
      }

      updateSelectionDraft(
        normalizeSelectionBounds({
          start: currentShapeStart,
          end: pointerPosition,
        }),
      );
      return;
    }

    const current = draftShapeRef.current;
    const currentShapeStart = shapeStartRef.current;

    if (!current || !currentShapeStart) {
      return;
    }

    if (current.type === "marker") {
      updateDraftShape({
        ...current,
        points: [...current.points, pointerPosition.x, pointerPosition.y],
      });
      return;
    }

    if (current.type === "line") {
      updateDraftShape({
        ...current,
        points: [
          current.points[0],
          current.points[1],
          pointerPosition.x,
          pointerPosition.y,
        ],
      });
      return;
    }

    if (current.type !== "rectangle") {
      return;
    }

    updateDraftShape(
      normalizeRectangle({
        id: current.id,
        start: currentShapeStart,
        end: pointerPosition,
        fill: current.fill,
        stroke: current.stroke,
        strokeWidth: current.strokeWidth,
      }),
    );
  }

  function handleDrawEnd() {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;
    if (tool === "select-move") {
      void completeSelection(selectionDraftRef.current);
      return;
    }

    completeShape(draftShapeRef.current);
  }

  function undoLastShape() {
    setShapes((current) => {
      const shape = current.at(-1);

      if (!shape) {
        return current;
      }

      if (shape.id === pendingSelectionId) {
        setPendingSelectionId(null);
      }

      setRedoShapes((redoCurrent) => [...redoCurrent, shape]);
      return current.slice(0, -1);
    });
  }

  function redoLastShape() {
    setRedoShapes((current) => {
      const shape = current.at(-1);

      if (!shape) {
        return current;
      }

      setShapes((shapeCurrent) => [...shapeCurrent, shape]);
      setPendingSelectionId(null);
      return current.slice(0, -1);
    });
  }

  function clearShapes() {
    setShapes([]);
    setRedoShapes([]);
    setPendingSelectionId(null);
    updateDraftShape(null);
    updateSelectionDraft(null);
    updateShapeStart(null);
    isDrawingRef.current = false;
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-2">
        <div className="flex items-center gap-1">
          <ToolButton
            active={tool === "rectangle"}
            disabled={disabled}
            label="Rectangle"
            onClick={() => handleToolChange("rectangle")}
          >
            <SquareIcon />
          </ToolButton>
          <ToolButton
            active={tool === "filled-rectangle"}
            disabled={disabled}
            label="Filled rectangle"
            onClick={() => handleToolChange("filled-rectangle")}
          >
            <SquareIcon className="fill-current" />
          </ToolButton>
          <ToolButton
            active={tool === "select-move"}
            disabled={disabled}
            label="Select and move"
            onClick={() => handleToolChange("select-move")}
          >
            <MousePointer2Icon />
          </ToolButton>
          <ToolButton
            active={tool === "line"}
            disabled={disabled}
            label="Line"
            onClick={() => handleToolChange("line")}
          >
            <MinusIcon />
          </ToolButton>
          <ToolButton
            active={tool === "marker"}
            disabled={disabled}
            label="Marker"
            onClick={() => handleToolChange("marker")}
          >
            <PencilIcon />
          </ToolButton>
        </div>

        <div className="h-6 w-px bg-border" aria-hidden="true" />

        <div className="flex items-center gap-1" aria-label="Stroke color">
          {STROKE_COLORS.map((color) => (
            <Button
              key={color}
              type="button"
              variant={strokeColor === color ? "secondary" : "outline"}
              size="icon-sm"
              disabled={disabled}
              className="p-1"
              aria-label={`Use color ${color}`}
              onClick={() => setStrokeColor(color)}
            >
              <span
                className="size-4 rounded-full border border-border"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            </Button>
          ))}
        </div>

        <div className="h-6 w-px bg-border" aria-hidden="true" />

        <div className="flex items-center gap-1.5" aria-label="Stroke width">
          <Select
            value={String(strokeWidth)}
            disabled={disabled}
            onValueChange={(value) => {
              setStrokeWidth(Number(value));
            }}
          >
            <SelectTrigger size="sm" className="w-20" aria-label="Stroke width">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {STROKE_WIDTH_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-px bg-border" aria-hidden="true" />

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled || shapes.length === 0}
            aria-label="Undo"
            title="Undo"
            onClick={undoLastShape}
          >
            <Undo2Icon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled || redoShapes.length === 0}
            aria-label="Redo"
            title="Redo"
            onClick={redoLastShape}
          >
            <Redo2Icon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled || shapes.length === 0}
            aria-label="Clear edits"
            title="Clear edits"
            onClick={clearShapes}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="min-h-0 overflow-auto rounded-lg border border-border bg-muted p-3"
      >
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-md bg-background shadow-sm ring-1 ring-border",
            imageState.status !== "loaded" &&
              "flex min-h-64 items-center justify-center",
          )}
          style={{
            width: imageState.status === "loaded" ? stageWidth : undefined,
            height: imageState.status === "loaded" ? stageHeight : undefined,
          }}
        >
          {imageState.status === "loading" ? (
            <p className="text-sm text-muted-foreground">Loading image...</p>
          ) : imageState.status === "error" ? (
            <p className="text-sm text-destructive">{imageState.message}</p>
          ) : (
            <Stage
              ref={stageRef}
              width={stageWidth}
              height={stageHeight}
              className={cn(
                disabled ? "cursor-not-allowed" : "cursor-crosshair",
              )}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            >
              <Layer scaleX={scale} scaleY={scale}>
                <KonvaImage
                  image={imageState.image}
                  width={imageWidthPx}
                  height={imageHeightPx}
                />
                {visibleShapes.map((shape) => {
                  if (shape.type === "selection") {
                    const isPendingSelection = shape.id === pendingSelectionId;

                    return (
                      <Fragment key={shape.id}>
                        <Rect
                          x={shape.sourceX}
                          y={shape.sourceY}
                          width={shape.width}
                          height={shape.height}
                          fill="#ffffff"
                        />
                        {isPendingSelection ? (
                          <Group
                            id={shape.id}
                            name="selection-patch"
                            x={shape.x}
                            y={shape.y}
                            draggable={!disabled}
                            onMouseDown={(event) => {
                              event.cancelBubble = true;
                            }}
                            onTouchStart={(event) => {
                              event.cancelBubble = true;
                            }}
                            onDragMove={(event) => {
                              const nextPosition = clampSelectionPosition(
                                shape,
                                {
                                  x: event.target.x(),
                                  y: event.target.y(),
                                },
                              );

                              event.target.position(nextPosition);
                            }}
                            onDragEnd={(event) => {
                              updateSelectionShapePosition(shape.id, {
                                x: event.target.x(),
                                y: event.target.y(),
                              });
                            }}
                          >
                            <KonvaImage
                              image={shape.image}
                              width={shape.width}
                              height={shape.height}
                            />
                            <Rect
                              name="selection-ui"
                              width={shape.width}
                              height={shape.height}
                              stroke="#2563eb"
                              strokeWidth={2}
                              dash={[8, 6]}
                              listening={false}
                            />
                          </Group>
                        ) : (
                          <KonvaImage
                            image={shape.image}
                            x={shape.x}
                            y={shape.y}
                            width={shape.width}
                            height={shape.height}
                          />
                        )}
                      </Fragment>
                    );
                  }

                  if (shape.type === "rectangle") {
                    return (
                      <Rect
                        key={shape.id}
                        x={shape.x}
                        y={shape.y}
                        width={shape.width}
                        height={shape.height}
                        stroke={shape.stroke}
                        strokeWidth={shape.strokeWidth}
                        fill={shape.stroke}
                        fillEnabled={shape.fill}
                      />
                    );
                  }

                  return (
                    <Line
                      key={shape.id}
                      points={shape.points}
                      stroke={shape.stroke}
                      strokeWidth={shape.strokeWidth}
                      lineCap="round"
                      lineJoin="round"
                      tension={shape.type === "marker" ? 0.35 : 0}
                    />
                  );
                })}
                {selectionDraft ? (
                  <Rect
                    name="selection-ui"
                    x={selectionDraft.x}
                    y={selectionDraft.y}
                    width={selectionDraft.width}
                    height={selectionDraft.height}
                    stroke="#2563eb"
                    strokeWidth={2}
                    dash={[8, 6]}
                    fill="rgba(37, 99, 235, 0.08)"
                  />
                ) : null}
              </Layer>
            </Stage>
          )}
        </div>
      </div>
    </div>
  );
});
