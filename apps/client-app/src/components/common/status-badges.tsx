import type { BookImportStatus } from "@/graphql/generated/graphql";
import { Badge } from "@/components/ui/badge";

type BadgeVariant = "outline" | "secondary" | "success";

export function BookImportStatusBadge({
  status,
}: {
  status: BookImportStatus;
}) {
  return (
    <Badge variant={bookVariant(status)}>Import {formatStatus(status)}</Badge>
  );
}

function bookVariant(status: BookImportStatus): BadgeVariant {
  if (status === "IMPORTING") {
    return "secondary";
  }

  if (status === "COMPLETE") {
    return "success";
  }

  return "outline";
}

export function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
