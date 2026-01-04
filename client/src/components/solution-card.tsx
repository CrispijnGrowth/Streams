import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar, Pencil } from "lucide-react";
import { format } from "date-fns";
import type { SolutionWithProgress } from "@shared/schema";
import { SolutionStatus } from "@shared/schema";

interface SolutionCardProps {
  solution: SolutionWithProgress;
  onClick?: () => void;
  onEdit?: () => void;
  showDescription?: boolean;
  isDragging?: boolean;
}

export function SolutionCard({
  solution,
  onClick,
  onEdit,
  showDescription = true,
  isDragging = false,
}: SolutionCardProps) {
  const isOnHold = solution.status === SolutionStatus.ON_HOLD;
  const isOverdue =
    solution.milestoneDate &&
    new Date(solution.milestoneDate) < new Date() &&
    !isOnHold;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <Card
      className={`p-2.5 space-y-1.5 cursor-pointer hover-elevate active-elevate-2 transition-all group ${
        isDragging ? "shadow-xl scale-105 opacity-90" : ""
      } ${isOnHold ? "opacity-50 bg-muted" : ""}`}
      onClick={onClick}
      data-testid={`card-solution-${solution.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate" data-testid={`text-solution-name-${solution.id}`}>
            {solution.name}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {solution.milestoneDate && (
            <div
              className={`flex items-center gap-1 text-xs ${isOnHold ? "text-muted-foreground" : isOverdue ? "text-status-blocked" : "text-muted-foreground"}`}
            >
              <Calendar className="h-3 w-3" />
              <span className="font-mono">
                {format(new Date(solution.milestoneDate), "MMM d")}
              </span>
            </div>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleEdit}
            data-testid={`button-edit-solution-${solution.id}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {showDescription && solution.description && (
        <p className="text-xs text-muted-foreground line-clamp-1">
          {solution.description}
        </p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ProgressBar value={solution.progress} size="sm" showLabel={false} muted={isOnHold} />
        </div>
        <span className="text-xs font-mono text-muted-foreground">{Math.round(solution.progress)}%</span>
        {solution.deliverableCount > 0 && (
          <span className="text-xs text-muted-foreground">{solution.deliverableCount}D</span>
        )}
        <span className="text-xs text-muted-foreground">{solution.actionCount}A</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {solution.doingCount > 0 && (
          <Badge 
            variant="outline" 
            className={`text-xs py-0 h-5 ${isOnHold ? "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30" : "bg-status-executing/10 text-status-executing border-status-executing/30"}`}
          >
            {solution.doingCount} Doing
          </Badge>
        )}
        {solution.blockedCount > 0 && (
          <Badge 
            variant="outline" 
            className={`text-xs py-0 h-5 ${isOnHold ? "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30" : "bg-status-blocked/10 text-status-blocked border-status-blocked/30"}`}
          >
            {solution.blockedCount} Blocked
          </Badge>
        )}
        {solution.labels.length > 0 && (
          <>
            {solution.labels.slice(0, 2).map((label) => (
              <Badge key={label} variant="secondary" className="text-xs py-0 h-5">
                {label}
              </Badge>
            ))}
            {solution.labels.length > 2 && (
              <span className="text-xs text-muted-foreground">+{solution.labels.length - 2}</span>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
