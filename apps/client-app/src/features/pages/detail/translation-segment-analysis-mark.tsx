import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type { TranslationSegmentColorStyle } from "./translation-segment-colors";

type TranslationSegmentAnalysisMarkProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "children" | "style"
> & {
  children: ReactNode;
  colorStyle: TranslationSegmentColorStyle;
  isSelected: boolean;
  onToggle: () => void;
};

function hasActiveTextSelection() {
  return Boolean(window.getSelection()?.toString().trim());
}

export const TranslationSegmentAnalysisMark = forwardRef<
  HTMLSpanElement,
  TranslationSegmentAnalysisMarkProps
>(function TranslationSegmentAnalysisMark(
  {
    children,
    className,
    colorStyle,
    isSelected,
    onClick,
    onKeyDown,
    onToggle,
    ...props
  },
  ref,
) {
  const style = {
    ...colorStyle,
    backgroundImage:
      "linear-gradient(var(--translation-segment-color), var(--translation-segment-color))",
    backgroundPosition: "center 100%",
    backgroundRepeat: "no-repeat",
    backgroundSize: `calc(100% - 4px) ${isSelected ? "3px" : "2px"}`,
  };

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    if (hasActiveTextSelection()) {
      event.preventDefault();
      return;
    }

    event.stopPropagation();
    onToggle();
    onClick?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      onKeyDown?.(event);
      return;
    }

    event.preventDefault();
    onToggle();
    onKeyDown?.(event);
  }

  return (
    <span
      {...props}
      ref={ref}
      role="button"
      tabIndex={0}
      style={style}
      aria-pressed={isSelected}
      className={cn(
        "cursor-default rounded-sm pb-0.5 [box-decoration-break:clone] [line-height:inherit] transition-colors hover:bg-(--translation-segment-background) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--translation-segment-color) focus-visible:ring-offset-2",
        isSelected && "bg-(--translation-segment-background)",
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </span>
  );
});
