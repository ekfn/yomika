import { BotOffIcon, CaptionsOffIcon } from "lucide-react";
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";

export function VocabularyDisabledBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          aria-label="Vocabulary disabled"
          className="px-1.5 text-muted-foreground"
          variant="outline"
        >
          <CaptionsOffIcon aria-hidden="true" />
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        Vocabulary disabled
      </TooltipContent>
    </Tooltip>
  );
}

export function AiProcessingDisabledBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          aria-label="AI processing disabled"
          className="px-1.5 text-muted-foreground"
          variant="outline"
        >
          <BotOffIcon aria-hidden="true" />
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        AI processing disabled
      </TooltipContent>
    </Tooltip>
  );
}
