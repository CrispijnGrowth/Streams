import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar, User, GripVertical } from "lucide-react";
import { format } from "date-fns";
import type { ActionWithProgress } from "@shared/schema";

interface ActionCardProps {
  action: ActionWithProgress;
  onClick?: () => void;
  showDescription?: boolean;
  isDragging?: boolean;
  showDragHandle?: boolean;
}

export function ActionCard({
  action,
  onClick,
  showDescription = true,
  isDragging = false,
  showDragHandle = false,
}: ActionCardProps) {
  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    action.status !== "Done" &&
    action.status !== "Archive";

  return (
    <Card
      className={`p-3 space-y-2 cursor-pointer hover-elevate active-elevate-2 transition-all ${
        isDragging ? "shadow-xl scale-105 opacity-90" : ""
      }`}
      onClick={onClick}
      data-testid={`card-action-${action.id}`}
    >
      <div className="flex items-start gap-2">
        {showDragHandle && (
          <div className="pt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate" data-testid={`text-action-name-${action.id}`}>
            {action.name}
          </h4>
          {showDescription && action.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {action.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        {action.dueDate && (
          <div
            className={`flex items-center gap-1 text-muted-foreground ${
              isOverdue ? "text-status-blocked" : ""
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span className="font-mono">
              {format(new Date(action.dueDate), "MMM d")}
            </span>
          </div>
        )}
        {action.effort && (
          <Badge variant="secondary" className="text-xs">
            {action.effort}h
          </Badge>
        )}
      </div>

      {action.stepCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {action.doneStepCount}/{action.stepCount} steps
            </span>
          </div>
          <ProgressBar value={action.progress} size="sm" showLabel={false} />
        </div>
      )}

      {action.owners.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate">{action.owners.join(", ")}</span>
        </div>
      )}

      {action.labels.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {action.labels.slice(0, 2).map((label) => (
            <Badge key={label} variant="outline" className="text-xs px-1.5 py-0">
              {label}
            </Badge>
          ))}
          {action.labels.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{action.labels.length - 2}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
