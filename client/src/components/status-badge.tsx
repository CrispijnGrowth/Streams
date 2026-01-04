import { Badge } from "@/components/ui/badge";
import type { ActionStatusType, MomentumStatusType, SolutionStatusType } from "@shared/schema";

interface StatusBadgeProps {
  status: ActionStatusType;
  size?: "sm" | "default";
}

const statusStyles: Record<ActionStatusType, string> = {
  Backlog: "bg-status-backlog/20 text-status-backlog border-status-backlog/30",
  "To Execute": "bg-status-to-execute/20 text-status-to-execute border-status-to-execute/30",
  Executing: "bg-status-executing/20 text-status-executing border-status-executing/30",
  Blocked: "bg-status-blocked/20 text-status-blocked border-status-blocked/30",
  Delegated: "bg-status-delegated/20 text-status-delegated border-status-delegated/30",
  Done: "bg-status-done/20 text-status-done border-status-done/30",
  Archive: "bg-status-archive/20 text-status-archive border-status-archive/30",
};

export function StatusBadge({ status, size = "default" }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${statusStyles[status]} ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      data-testid={`badge-status-${status.toLowerCase().replace(" ", "-")}`}
    >
      {status === "Executing" ? "Doing" : status}
    </Badge>
  );
}

interface SolutionStatusBadgeProps {
  status: SolutionStatusType;
  size?: "sm" | "default";
}

const solutionStatusStyles: Record<SolutionStatusType, string> = {
  "In Progress": "bg-status-executing/20 text-status-executing border-status-executing/30",
  "On Hold": "bg-muted text-muted-foreground border-border",
};

export function SolutionStatusBadge({ status, size = "default" }: SolutionStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${solutionStatusStyles[status]} ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      data-testid={`badge-solution-status-${status.toLowerCase().replace(" ", "-")}`}
    >
      {status}
    </Badge>
  );
}

interface MomentumBadgeProps {
  status: MomentumStatusType;
}

const momentumStyles: Record<MomentumStatusType, string> = {
  Active: "bg-momentum-active/20 text-momentum-active border-momentum-active/30",
  Slowing: "bg-momentum-slowing/20 text-momentum-slowing border-momentum-slowing/30",
  Stalled: "bg-momentum-stalled/20 text-momentum-stalled border-momentum-stalled/30",
};

export function MomentumBadge({ status }: MomentumBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${momentumStyles[status]} text-xs`}
      data-testid={`badge-momentum-${status.toLowerCase()}`}
    >
      {status}
    </Badge>
  );
}
