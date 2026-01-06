import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import type { ActionStatusType, MomentumStatusType } from "@shared/schema";
import { format } from "date-fns";

type MarkerShape = "circle" | "diamond";

interface TimelineBallProps {
  id: string;
  title: string;
  description?: string;
  date?: string;
  status?: ActionStatusType;
  momentumStatus?: MomentumStatusType;
  progress?: number;
  isNoDate?: boolean;
  onClick?: () => void;
  onDragEnd?: (newDate: string) => void;
  size?: "sm" | "default" | "lg";
  counts?: {
    doing?: number;
    blocked?: number;
    delegated?: number;
  };
  enterAnimation?: {
    active: boolean;
    delayMs: number;
  };
  shape?: MarkerShape;
  borderColor?: string;
}

function generateAcronym(title: string): string {
  const words = title.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return "";
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase();
  }
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}

const statusColors: Record<ActionStatusType, string> = {
  Backlog: "bg-status-backlog",
  "To Execute": "bg-status-to-execute",
  Executing: "bg-status-executing",
  Blocked: "bg-status-blocked",
  Delegated: "bg-status-delegated",
  Done: "bg-status-done",
  Archive: "bg-status-archive",
};

const momentumColors: Record<MomentumStatusType, string> = {
  Active: "bg-momentum-active",
  Slowing: "bg-momentum-slowing",
  Stalled: "bg-momentum-stalled",
};

const borderColorClasses: Record<string, string> = {
  cyan: "border-cyan-400",
  pink: "border-pink-400",
  yellow: "border-yellow-400",
  green: "border-green-400",
  purple: "border-purple-400",
  orange: "border-orange-400",
};

export function TimelineBall({
  id,
  title,
  description,
  date,
  status,
  momentumStatus,
  progress,
  isNoDate = false,
  onClick,
  size = "default",
  counts,
  enterAnimation,
  shape = "circle",
  borderColor,
}: TimelineBallProps) {
  const [isHovered, setIsHovered] = useState(false);
  const acronym = generateAcronym(title);
  
  const animationStyle = enterAnimation?.active 
    ? { animationDelay: `${enterAnimation.delayMs}ms` }
    : undefined;

  const sizeClasses = {
    sm: "w-6 h-6",
    default: "w-9 h-9",
    lg: "w-11 h-11",
  };

  const textSizeClasses = {
    sm: "text-[7px]",
    default: "text-[9px]",
    lg: "text-[10px]",
  };

  const getBallColor = () => {
    if (momentumStatus) {
      return momentumColors[momentumStatus];
    }
    if (status) {
      return statusColors[status];
    }
    return "bg-primary";
  };

  const shapeClass = shape === "diamond" ? "rotate-45 rounded-sm" : "rounded-full";
  const borderColorClass = borderColor ? borderColorClasses[borderColor] || "" : "";

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          className={`
            ${sizeClasses[size]}
            ${isNoDate ? "border-2 border-dashed border-muted-foreground/50 bg-transparent" : getBallColor()}
            ${shapeClass}
            ${borderColor ? `border-2 ${borderColorClass}` : ""}
            transition-all duration-200 ease-out
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
            cursor-pointer
            flex items-center justify-center
            ${isHovered ? "scale-110 shadow-lg" : "shadow-sm"}
            ${momentumStatus === "Stalled" || momentumStatus === "Slowing" ? "opacity-70" : ""}
            ${enterAnimation?.active ? "animate-ball-enter" : ""}
          `}
          style={animationStyle}
          onClick={onClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          data-testid={`ball-${id}`}
          aria-label={`${title}${date ? `, ${format(new Date(date), "MMM d, yyyy")}` : ", no date"}`}
        >
          <span className={`${textSizeClasses[size]} font-bold leading-none ${isNoDate ? 'text-muted-foreground' : 'text-white'} ${shape === "diamond" ? "-rotate-45" : ""}`}>
            {acronym}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="min-w-64 max-w-sm p-4 space-y-2 z-[100]"
        data-testid={`tooltip-${id}`}
      >
        <div className="space-y-1">
          <h4 className="font-medium text-sm">{title}</h4>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {date && (
            <span className="text-xs font-mono text-muted-foreground">
              {format(new Date(date), "MMM d, yyyy")}
            </span>
          )}
          {status && <StatusBadge status={status} size="sm" />}
        </div>
        {progress !== undefined && (
          <div className="pt-1">
            <ProgressBar value={progress} size="sm" />
          </div>
        )}
        {counts && (counts.doing || counts.blocked || counts.delegated) && (
          <div className="flex items-center gap-2 text-xs pt-1">
            {counts.doing !== undefined && counts.doing > 0 && (
              <span className="text-status-executing">{counts.doing} Doing</span>
            )}
            {counts.blocked !== undefined && counts.blocked > 0 && (
              <span className="text-status-blocked">{counts.blocked} Blocked</span>
            )}
            {counts.delegated !== undefined && counts.delegated > 0 && (
              <span className="text-status-delegated">{counts.delegated} Delegated</span>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
