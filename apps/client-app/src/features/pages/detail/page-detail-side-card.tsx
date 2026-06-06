import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

type PageDetailSideCardProps = {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

export function PageDetailSideCard({
  title,
  actions,
  children,
  contentClassName,
}: PageDetailSideCardProps) {
  return (
    <Card className="min-h-64 gap-0 overflow-hidden py-0 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:self-start">
      <CardHeader className="shrink-0 border-b border-border py-3">
        <CardTitle>{title}</CardTitle>
        {actions ? (
          <div className="col-span-full row-start-2 flex justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn("min-h-0 overflow-y-auto py-4", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}
