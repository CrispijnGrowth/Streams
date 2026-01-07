import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar, Pencil, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import type { SolutionWithBreakdownAndComment, DeliverableBreakdown, ActionStatusType, DeliverableBorderColorType } from "@shared/schema";
import { SolutionStatus, ActionStatus } from "@shared/schema";

interface SolutionCardProps {
  solution: SolutionWithBreakdownAndComment;
  onClick?: () => void;
  onEdit?: () => void;
  showDescription?: boolean;
  isDragging?: boolean;
}

const borderColorMap: Record<DeliverableBorderColorType, string> = {
  cyan: "var(--deliverable-cyan)",
  magenta: "var(--deliverable-magenta)",
  yellow: "var(--deliverable-yellow)",
  lime: "var(--deliverable-lime)",
  orange: "var(--deliverable-orange)",
  pink: "var(--deliverable-pink)",
  blue: "var(--deliverable-blue)",
  green: "var(--deliverable-green)",
};

function getStatusColor(status: ActionStatusType): string {
  switch (status) {
    case ActionStatus.EXECUTING:
      return "hsl(var(--status-executing))";
    case ActionStatus.BLOCKED:
      return "hsl(var(--status-blocked))";
    case ActionStatus.DELEGATED:
      return "hsl(var(--status-delegated))";
    default:
      return "hsl(var(--muted-foreground))";
  }
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
      } ${isOnHold ? "opacity-60 grayscale" : ""}`}
      onClick={onClick}
      data-testid={`card-solution-${solution.id}`}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium" data-testid={`text-solution-key-${solution.id}`}>
        {solution.displayKey}
      </span>
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

      {solution.deliverableBreakdown && solution.deliverableBreakdown.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          {solution.deliverableBreakdown.map((deliverable) => {
            const borderColor = `hsl(${borderColorMap[deliverable.borderColor] || "var(--deliverable-cyan)"})`;
            return (
              <div 
                key={deliverable.id} 
                className="space-y-0.5 p-1.5 rounded-md"
                style={{ border: `1px solid ${borderColor}` }}
              >
                <div className="text-xs font-medium text-foreground/80 truncate">
                  {deliverable.name}
                </div>
                {deliverable.activeActions.length > 0 ? (
                  <div className="space-y-0.5 pl-2">
                    {deliverable.activeActions.map((action) => (
                      <div key={action.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: getStatusColor(action.status) }}
                        />
                        <span className="truncate">{action.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground/60 pl-2 italic">
                    No active actions
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {solution.labels.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {solution.labels.slice(0, 2).map((label) => (
            <Badge key={label} variant="secondary" className="text-xs py-0 h-5">
              {label}
            </Badge>
          ))}
          {solution.labels.length > 2 && (
            <span className="text-xs text-muted-foreground">+{solution.labels.length - 2}</span>
          )}
        </div>
      )}

      {solution.lastComment && (
        <div className="flex items-start gap-1.5 pt-1 border-t border-border/50">
          <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {solution.lastComment.content}
            </p>
            <span className="text-[10px] text-muted-foreground/60">
              {format(new Date(solution.lastComment.createdAt), "MMM d, h:mm a")}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
