import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar, User, Pencil } from "lucide-react";
import { format } from "date-fns";
import type { DeliverableWithProgress } from "@shared/schema";

interface DeliverableCardProps {
  deliverable: DeliverableWithProgress;
  onClick?: () => void;
  onEdit?: () => void;
  showDescription?: boolean;
  isDragging?: boolean;
}

export function DeliverableCard({
  deliverable,
  onClick,
  onEdit,
  showDescription = true,
  isDragging = false,
}: DeliverableCardProps) {
  const isOverdue =
    deliverable.milestoneDate &&
    new Date(deliverable.milestoneDate) < new Date() &&
    deliverable.status !== "Done" &&
    deliverable.status !== "Archive";

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <Card
      className={`p-3 space-y-2 cursor-pointer hover-elevate active-elevate-2 transition-all group ${
        isDragging ? "shadow-xl scale-105 opacity-90" : ""
      }`}
      onClick={onClick}
      data-testid={`card-deliverable-${deliverable.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate" data-testid={`text-deliverable-name-${deliverable.id}`}>
            {deliverable.name}
          </h4>
          {showDescription && deliverable.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {deliverable.description}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={handleEdit}
          data-testid={`button-edit-deliverable-${deliverable.id}`}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        <StatusBadge status={deliverable.status} size="sm" />
        {deliverable.milestoneDate && (
          <div
            className={`flex items-center gap-1 text-muted-foreground ${
              isOverdue ? "text-status-blocked" : ""
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span className="font-mono">
              {format(new Date(deliverable.milestoneDate), "MMM d")}
            </span>
          </div>
        )}
      </div>

      <ProgressBar value={deliverable.progress} size="sm" />

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span>{deliverable.actionCount} Actions</span>
        {deliverable.doingCount > 0 && (
          <span className="text-status-executing">{deliverable.doingCount} Doing</span>
        )}
        {deliverable.blockedCount > 0 && (
          <span className="text-status-blocked">{deliverable.blockedCount} Blocked</span>
        )}
      </div>

      {deliverable.owners.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate">{deliverable.owners.join(", ")}</span>
        </div>
      )}
    </Card>
  );
}
