import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  breadcrumbs?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  breadcrumbs,
  title,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:justify-between",
        title ? "md:items-end" : "md:items-center",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {breadcrumbs}
        {title ? (
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
            {title}
          </h1>
        ) : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
