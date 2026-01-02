import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DescriptionsToggleProps {
  showDescriptions: boolean;
  onToggle: () => void;
}

export function DescriptionsToggle({ showDescriptions, onToggle }: DescriptionsToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={showDescriptions ? "" : "text-muted-foreground"}
          data-testid="button-toggle-descriptions"
        >
          {showDescriptions ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
          <span className="sr-only">
            {showDescriptions ? "Hide descriptions" : "Show descriptions"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{showDescriptions ? "Hide descriptions (D)" : "Show descriptions (D)"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
