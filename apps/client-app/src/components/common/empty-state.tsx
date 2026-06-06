import type { ReactNode } from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";

type EmptyStateProps = {
  title: string;
  children?: ReactNode;
};

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <Empty className="border bg-card/60">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
      {children ? (
        <EmptyDescription className="max-w-lg">{children}</EmptyDescription>
      ) : null}
    </Empty>
  );
}
