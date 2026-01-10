import { useRef } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useTeamMembers } from "@/hooks/use-suggestions";
import { useMode } from "@/lib/mode-context";
import { useHeroTransition } from "@/lib/hero-transition-context";
import type { SolutionWithBreakdownAndComment, ActionStatusType, DeliverableBorderColorType } from "@shared/schema";
import { SolutionStatus, ActionStatus } from "@shared/schema";

interface SolutionCardProps {
  solution: SolutionWithBreakdownAndComment;
  onClick?: () => void;
  onEdit?: () => void;
  showDescription?: boolean;
  isDragging?: boolean;
  streamName?: string;
  onStreamClick?: () => void;
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
  streamName,
  onStreamClick,
}: SolutionCardProps) {
  const teamMembers = useTeamMembers();
  const { isEditMode } = useMode();
  const { startTransition } = useHeroTransition();
  const [, setLocation] = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const isOnHold = solution.status === SolutionStatus.ON_HOLD;
  const isOverdue =
    solution.milestoneDate &&
    new Date(solution.milestoneDate) < new Date() &&
    !isOnHold;
  
  const getOwnerInfo = (ownerName: string) => {
    return teamMembers.find((m) => m.name === ownerName);
  };
  
  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleCardClick = () => {
    if (isEditMode) {
      onEdit?.();
    } else if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      startTransition(
        {
          sourceRect: rect,
          solutionId: solution.id,
          solutionName: solution.name,
          displayKey: solution.displayKey || "",
        },
        () => {
          setLocation(`/stream/${solution.streamId}/solution/${solution.id}`);
        }
      );
    } else {
      onClick?.();
    }
  };

  const owners = solution.owners || [];
  const hasMultipleOwners = owners.length > 1;

  return (
    <Card
      ref={cardRef}
      className={`p-2.5 cursor-pointer hover-elevate active-elevate-2 transition-all group ${
        isDragging ? "shadow-xl scale-105 opacity-90" : ""
      } ${isOnHold ? "opacity-60 grayscale" : ""} ${
        isEditMode 
          ? "border-2 border-dashed border-primary" 
          : ""
      }`}
      onClick={handleCardClick}
      data-testid={`card-solution-${solution.id}`}
    >
      <div className={`relative ${hasMultipleOwners ? "pr-14" : "pr-12"}`}>
        {owners.length > 0 && (
          <div className="absolute top-0 right-0 flex items-center -space-x-2">
            {owners.slice(0, 3).map((owner, index) => {
              const ownerInfo = getOwnerInfo(owner);
              const avatarSize = hasMultipleOwners ? "h-7 w-7" : "h-10 w-10";
              const textSize = hasMultipleOwners ? "text-[10px]" : "text-sm";
              return (
                <Tooltip key={owner}>
                  <TooltipTrigger asChild>
                    <Avatar 
                      className={`${avatarSize} border-2 border-background`}
                      style={{ zIndex: 10 - index }}
                    >
                      {(ownerInfo?.photoData || ownerInfo?.photoUrl) ? (
                        <AvatarImage src={ownerInfo.photoData || ownerInfo.photoUrl || ""} alt={owner} className="object-cover" />
                      ) : null}
                      <AvatarFallback className={`bg-primary/10 text-primary ${textSize}`}>
                        {getInitials(owner)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{owner}</p>
                    {ownerInfo?.role && <p className="text-xs text-muted-foreground">{ownerInfo.role}</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {owners.length > 3 && (
              <Avatar className="h-7 w-7 border-2 border-background" style={{ zIndex: 5 }}>
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                  +{owners.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}

        <div className="space-y-0.5">
          {streamName && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStreamClick?.();
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors truncate block max-w-full text-left"
              data-testid={`link-stream-${solution.streamId}`}
            >
              {streamName}
            </button>
          )}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium" data-testid={`text-solution-key-${solution.id}`}>
            {solution.displayKey}
          </span>
          <h4 className="font-medium text-sm" data-testid={`text-solution-name-${solution.id}`}>
            {solution.name}
          </h4>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {solution.priority && (
          <span 
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono ${
              solution.priority === 1 ? "text-xs font-bold border-foreground/60 bg-foreground/15 text-foreground" :
              solution.priority === 2 ? "text-xs font-semibold border-foreground/50 bg-foreground/12 text-foreground/90" :
              solution.priority === 3 ? "text-[11px] font-medium border-foreground/40 bg-foreground/8 text-foreground/80" :
              solution.priority === 4 ? "text-[10px] font-normal border-foreground/30 bg-foreground/5 text-foreground/70" :
              "text-[10px] font-normal border-foreground/20 bg-foreground/3 text-foreground/60"
            }`}
            data-testid={`badge-priority-${solution.id}`}
          >
            Prio {solution.priority}
          </span>
        )}
        {solution.milestoneDate && (
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium ${
              isOnHold 
                ? "bg-muted text-muted-foreground" 
                : isOverdue 
                  ? "bg-status-blocked/10 text-status-blocked" 
                  : "bg-primary/10 text-primary"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="font-mono">
              {format(new Date(solution.milestoneDate), "MMM d")}
            </span>
          </div>
        )}
      </div>

      {showDescription && solution.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
          {solution.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1">
          <ProgressBar value={solution.progress} size="sm" showLabel={false} muted={isOnHold} />
        </div>
        <span className="text-xs font-mono text-muted-foreground">{Math.round(solution.progress)}%</span>
      </div>

      {solution.deliverableBreakdown && solution.deliverableBreakdown.length > 0 && (
        <div className="space-y-1.5 pt-1 mt-1.5 border-t border-border/50">
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
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
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
        <div className="flex items-start gap-1.5 pt-1 mt-1.5 border-t border-border/50">
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
