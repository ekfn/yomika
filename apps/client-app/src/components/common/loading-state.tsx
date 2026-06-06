import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  className?: string;
  delayMs?: number;
};

export function LoadingState({ className, delayMs = 250 }: LoadingStateProps) {
  const [isVisible, setIsVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setIsVisible(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsVisible(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex min-h-12 items-center justify-center animate-in fade-in-0 duration-500",
        className,
      )}
    >
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
