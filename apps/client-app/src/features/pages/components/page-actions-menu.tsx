import { type MouseEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontalIcon } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import { GuardedDropdownMenuItem } from "@/components/common/guarded-dropdown-menu-item";
import type {
  PageListFieldsFragment,
  PageQuery,
} from "@/graphql/generated/graphql";
import { getPageRoute } from "@/lib/library-paths";
import { PageImageEditDialog } from "@/features/pages/image-editor/page-image-edit-dialog";
import { PageAiStatusDialog } from "./page-ai-status-dialog";
import { PageOptionsDialog } from "./page-options-dialog";
import { PageRenameDialog } from "./page-rename-dialog";

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
  extraDialogs?: ReactNode;
  extraMenuItems?: ReactNode;
  isRunnerRunning?: boolean;
  onCompleted?: ((path?: string) => Promise<void> | void) | undefined;
};

export function PageActionsMenu({
  buttonVariant = "ghost",
  name,
  page,
  extraDialogs,
  extraMenuItems,
  isRunnerRunning = false,
  onCompleted,
}: PageActionsMenuProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isImageEditOpen, setIsImageEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const canRename = !page.bookPath;
  const hasSecondaryItems = canRename || Boolean(extraMenuItems);

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
                Open Page
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsOptionsOpen(true);
              }}
            >
              Edit Page Options
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsImageEditOpen(true);
              }}
            >
              Edit Page Image
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsStatusOpen(true);
              }}
            >
              Edit Page Status
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {hasSecondaryItems ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {canRename ? (
                  <GuardedDropdownMenuItem
                    disabled={isRunnerRunning}
                    tooltip="Wait until the runner finishes or stop it before renaming items."
                    onSelect={() => {
                      setIsRenameOpen(true);
                    }}
                  >
                    Rename Page
                  </GuardedDropdownMenuItem>
                ) : null}
                {extraMenuItems}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <PageImageEditDialog
        open={isImageEditOpen}
        pagePath={page.path}
        onOpenChange={setIsImageEditOpen}
        {...(onCompleted ? { onCompleted } : {})}
      />
      <PageRenameDialog
        open={isRenameOpen}
        page={page}
        trigger={null}
        onOpenChange={setIsRenameOpen}
        {...(onCompleted ? { onCompleted } : {})}
      />
      <PageOptionsDialog
        open={isOptionsOpen}
        page={page}
        trigger={null}
        onOpenChange={setIsOptionsOpen}
        {...(onCompleted ? { onCompleted } : {})}
      />
      <PageAiStatusDialog
        open={isStatusOpen}
        page={page}
        onCompleted={() => onCompleted?.(page.path)}
        onOpenChange={setIsStatusOpen}
      />
      {extraDialogs}
    </div>
  );
}
