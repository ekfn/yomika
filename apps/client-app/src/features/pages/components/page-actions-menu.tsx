import { type MouseEvent, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontalIcon } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import type {
  PageListFieldsFragment,
  PageQuery,
} from "@/graphql/generated/graphql";
import { getPageRoute } from "@/lib/library-paths";
import { PageImageEditDialog } from "@/features/pages/image-editor/page-image-edit-dialog";
import { PageAiStatusDialog } from "./page-ai-status-dialog";
import { PageFormDialog } from "./page-form-dialog";

type PageActionsMenuPage = Pick<
  NonNullable<PageQuery["page"]> | PageListFieldsFragment,
  | "path"
  | "bookPath"
  | "settings"
  | "effectiveSettings"
  | "ocrStatus"
  | "aiProcessingStatus"
>;

type PageActionsMenuProps = {
  buttonVariant?: "ghost" | "outline";
  name: string;
  page: PageActionsMenuPage;
  onCompleted?: ((path?: string) => Promise<void> | void) | undefined;
};

export function PageActionsMenu({
  buttonVariant = "ghost",
  name,
  page,
  onCompleted,
}: PageActionsMenuProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImageEditOpen, setIsImageEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const handleMenuClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="shrink-0" onClick={handleMenuClick}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={buttonVariant}
            size="icon-sm"
            aria-label={`More actions for ${name}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link
                to={getPageRoute(page.path)}
                target="_blank"
                rel="noreferrer"
              >
                Open page
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsEditOpen(true);
              }}
            >
              Edit Page
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsImageEditOpen(true);
              }}
            >
              Edit Image
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsStatusOpen(true);
              }}
            >
              Edit Page Status
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <PageImageEditDialog
        open={isImageEditOpen}
        pagePath={page.path}
        onOpenChange={setIsImageEditOpen}
        {...(onCompleted ? { onCompleted } : {})}
      />
      <PageFormDialog
        open={isEditOpen}
        page={page}
        trigger={null}
        onOpenChange={setIsEditOpen}
        {...(onCompleted ? { onCompleted } : {})}
      />
      <PageAiStatusDialog
        open={isStatusOpen}
        page={page}
        onCompleted={() => onCompleted?.(page.path)}
        onOpenChange={setIsStatusOpen}
      />
    </div>
  );
}
