import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MomentumBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { CardStakeholderTags } from "@/components/card-stakeholder-tags";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { useTeamMembers } from "@/hooks/use-suggestions";
import { useMode } from "@/lib/mode-context";
import type { StreamWithProgress, MomentumStatusType } from "@shared/schema";
import { SolutionStatus } from "@shared/schema";

interface StreamCardProps {
  stream: StreamWithProgress;
  onClick?: () => void;
  onEdit?: () => void;
  onMomentumClick?: (newStatus: MomentumStatusType) => void;
  showDescription?: boolean;
}

export function StreamCard({ stream, onClick, onEdit, onMomentumClick, showDescription = true }: StreamCardProps) {
  const teamMembers = useTeamMembers();
  const { isEditMode } = useMode();
  const [, setLocation] = useLocation();
  const isOnHold = stream.status === SolutionStatus.ON_HOLD;
  
  const isOverdue =
    stream.computedMilestoneDate &&
    new Date(stream.computedMilestoneDate) < new Date() &&
    stream.progress < 100 &&
    !isOnHold;
  
  const getOwnerInfo = (ownerName: string) => {
    const member = teamMembers.find((m) => m.name === ownerName);
    return member;
  };
  
  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleCardClick = () => {
    if (isEditMode) {
      onEdit?.();
    } else {
      setLocation(`/stream/${stream.id}`);
    }
  };

  const handleMomentumClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onMomentumClick) return;
    
    const nextStatus: Record<MomentumStatusType, MomentumStatusType> = {
      Active: "Slowing",
      Slowing: "Stalled",
      Stalled: "Active",
    };
    onMomentumClick(nextStatus[stream.momentumStatus]);
  };

  const owners = stream.owners || [];
  const hasMultipleOwners = owners.length > 1;

  return (
    <Card
      className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-all group shadow-sm ${
        isOnHold ? "opacity-60 grayscale" : ""
      } ${
        isEditMode 
          ? "border-2 border-dashed border-primary" 
          : "border-2 border-[#0066FF]"
      }`}
      onClick={handleCardClick}
      data-testid={`card-stream-${stream.id}`}
    >
      <div className={`relative ${hasMultipleOwners ? "pr-16" : "pr-14"}`}>
        {owners.length > 0 && (
          <div className="absolute top-0 right-0 flex items-center -space-x-2">
            {owners.slice(0, 4).map((owner, index) => {
              const ownerInfo = getOwnerInfo(owner);
              const avatarSize = hasMultipleOwners ? "h-8 w-8" : "h-12 w-12";
              const textSize = hasMultipleOwners ? "text-xs" : "text-base";
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
            {owners.length > 4 && (
              <Avatar className="h-8 w-8 border-2 border-background" style={{ zIndex: 5 }}>
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  +{owners.length - 4}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}

        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium" data-testid={`text-stream-key-${stream.id}`}>
            {stream.displayKey}
          </span>
          <h3 className="font-semibold text-base" data-testid={`text-stream-name-${stream.id}`}>
            {stream.name}
          </h3>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2">
        <MomentumBadge 
          status={stream.momentumStatus} 
          onClick={onMomentumClick ? handleMomentumClick : undefined}
          clickable={!!onMomentumClick}
        />
        {stream.computedMilestoneDate && (
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
              {format(new Date(stream.computedMilestoneDate), "MMM d")}
            </span>
          </div>
        )}
      </div>

      {showDescription && stream.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 mt-2">
          {stream.description}
        </p>
      )}

      <div className="space-y-2 mt-3">
        {[...stream.inProgressSolutions]
          .sort((a, b) => {
            // Sort by priority: P1 first, then P2, etc. No priority goes last
            if (a.priority && b.priority) return a.priority - b.priority;
            if (a.priority && !b.priority) return -1;
            if (!a.priority && b.priority) return 1;
            return 0;
          })
          .map((sol) => (
          <div key={sol.name} className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs line-clamp-1 flex-1 ${sol.isEarliest ? "font-medium" : "text-muted-foreground"}`}>
                {sol.name}
              </span>
              {sol.milestoneDate && (
                <span className={`text-[10px] font-mono shrink-0 ${sol.isEarliest ? "text-foreground" : "text-muted-foreground"}`}>
                  {format(new Date(sol.milestoneDate), "MMM d")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ProgressBar value={sol.progress} size="sm" showLabel={false} variant="stream" muted={isOnHold} />
              </div>
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                {Math.round(sol.progress)}%
              </span>
              {sol.priority && (
                <span 
                  className={`inline-flex items-center rounded-md border px-1 py-0 font-mono shrink-0 ${
                    sol.priority === 1 ? "text-[10px] font-bold border-foreground/60 bg-foreground/15 text-foreground" :
                    sol.priority === 2 ? "text-[10px] font-semibold border-foreground/50 bg-foreground/12 text-foreground/90" :
                    sol.priority === 3 ? "text-[9px] font-medium border-foreground/40 bg-foreground/8 text-foreground/80" :
                    sol.priority === 4 ? "text-[9px] font-normal border-foreground/30 bg-foreground/5 text-foreground/70" :
                    "text-[9px] font-normal border-foreground/20 bg-foreground/3 text-foreground/60"
                  }`}
                >
                  P{sol.priority}
                </span>
              )}
            </div>
          </div>
        ))}
        {stream.inProgressSolutions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No active solutions</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
        <CardStakeholderTags entityType="stream" entityId={stream.id} />
      </div>
    </Card>
  );
}
