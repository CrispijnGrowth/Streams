import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { CardStakeholderTags } from "@/components/card-stakeholder-tags";
import { Calendar, GripVertical, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useTeamMembers } from "@/hooks/use-suggestions";
import { useMode } from "@/lib/mode-context";
import type { ActionWithLastComment } from "@shared/schema";

interface ActionCardProps {
  action: ActionWithLastComment;
  onClick?: () => void;
  onEdit?: () => void;
  showDescription?: boolean;
  isDragging?: boolean;
  showDragHandle?: boolean;
}

export function ActionCard({
  action,
  onClick,
  onEdit,
  showDescription = true,
  isDragging = false,
  showDragHandle = false,
}: ActionCardProps) {
  const teamMembers = useTeamMembers();
  const { isEditMode } = useMode();
  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    action.status !== "Done" &&
    action.status !== "Archive";
  
  const getOwnerInfo = (ownerName: string) => {
    return teamMembers.find((m) => m.name === ownerName);
  };
  
  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleCardClick = () => {
    if (isEditMode) {
      onEdit?.();
    } else {
      onClick?.();
    }
  };

  return (
    <Card
      className={`p-3 space-y-2 cursor-pointer hover-elevate active-elevate-2 transition-all group ${
        isDragging ? "shadow-xl scale-105 opacity-90" : ""
      } ${isEditMode ? "border-2 border-dashed border-primary" : ""}`}
      onClick={handleCardClick}
      data-testid={`card-action-${action.id}`}
    >
      <div className="flex items-start gap-2">
        {showDragHandle && (
          <div className="pt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm line-clamp-2" data-testid={`text-action-name-${action.id}`}>
            {action.name}
          </h4>
          {showDescription && (
            action.lastComment ? (
              <div className="flex items-start gap-1 mt-0.5">
                <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {action.lastComment.content}
                </p>
              </div>
            ) : action.description ? (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {action.description}
              </p>
            ) : null
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

      <div className="flex items-center justify-between gap-2">
        <CardStakeholderTags entityType="action" entityId={action.id} />
        {action.owners.length > 0 && (
          <div className="flex items-center -space-x-1">
            {action.owners.slice(0, 3).map((owner) => {
              const info = getOwnerInfo(owner);
              return (
                <Tooltip key={owner}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-5 w-5 border-2 border-background">
                      {(info?.photoData || info?.photoUrl) ? (
                        <AvatarImage src={info.photoData || info.photoUrl || ""} alt={owner} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                        {getInitials(owner)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{owner}</p>
                    {info?.role && <p className="text-xs text-muted-foreground">{info.role}</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {action.owners.length > 3 && (
              <Avatar className="h-5 w-5 border-2 border-background">
                <AvatarFallback className="bg-muted text-muted-foreground text-[9px]">
                  +{action.owners.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
