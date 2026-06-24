import {
  DropdownMenuItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";

type GuardedDropdownMenuItemProps = {
  children: string;
  disabled: boolean;
  tooltip: string;
  onSelect: () => void;
};

export function GuardedDropdownMenuItem({
  children,
  disabled,
  tooltip,
  onSelect,
}: GuardedDropdownMenuItemProps) {
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">
            <DropdownMenuItem disabled className="w-full">
              {children}
            </DropdownMenuItem>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <DropdownMenuItem onSelect={onSelect}>{children}</DropdownMenuItem>;
}
