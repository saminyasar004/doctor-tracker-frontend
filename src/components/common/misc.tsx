import { format, formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function RelativeDate({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={iso}
          className="cursor-default whitespace-nowrap text-sm text-muted-foreground"
        >
          {formatDistanceToNow(d, { addSuffix: true })}
        </time>
      </TooltipTrigger>
      <TooltipContent>{format(d, "PPP 'at' p")}</TooltipContent>
    </Tooltip>
  );
}
