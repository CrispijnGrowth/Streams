import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MomentumBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { useTeamMembers } from "@/hooks/use-suggestions";
import { useMode } from "@/lib/mode-context";
import type { StreamWithProgress, MomentumStatusType } from "@shared/schema";

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
  
  const isOverdue =
    stream.computedMilestoneDate &&
    new Date(stream.computedMilestoneDate) < new Date() &&
    stream.progress < 100;
  
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
      onClick?.();
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

  const primaryOwner = stream.owners?.[0];
  const primaryOwnerInfo = primaryOwner ? getOwnerInfo(primaryOwner) : undefined;
  const additionalOwners = stream.owners?.slice(1) || [];

  return (
    <Card
      className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-shadow group shadow-sm ${
        isEditMode 
          ? "border-2 border-dashed border-primary" 
          : "border-2 border-[#0066FF]"
      }`}
      onClick={handleCardClick}
      data-testid={`card-stream-${stream.id}`}
    >
      <div className="relative pr-14">
        {primaryOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="absolute top-0 right-0 h-12 w-12 border-2 border-background">
                {primaryOwnerInfo?.photoUrl ? (
                  <AvatarImage src={primaryOwnerInfo.photoUrl} alt={primaryOwner} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-base">
                  {getInitials(primaryOwner)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{primaryOwner}</p>
              {primaryOwnerInfo?.role && <p className="text-xs text-muted-foreground">{primaryOwnerInfo.role}</p>}
            </TooltipContent>
          </Tooltip>
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
            className={`flex items-center gap-1 text-xs ${isOverdue ? "text-status-blocked" : "text-muted-foreground"}`}
          >
            <Calendar className="h-3 w-3" />
            <span className="font-mono">
              {format(new Date(stream.computedMilestoneDate), "MMM d")}
            </span>
          </div>
        )}
        {additionalOwners.length > 0 && (
          <div className="flex items-center -space-x-1 ml-auto">
            {additionalOwners.slice(0, 3).map((owner) => {
              const info = getOwnerInfo(owner);
              return (
                <Tooltip key={owner}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 border-2 border-background">
                      {info?.photoUrl ? (
                        <AvatarImage src={info.photoUrl} alt={owner} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
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
            {additionalOwners.length > 3 && (
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                  +{additionalOwners.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
      </div>

      {showDescription && stream.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 mt-2">
          {stream.description}
        </p>
      )}

      <div className="space-y-2 mt-3">
        {stream.inProgressSolutions.slice(0, 3).map((sol) => (
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
                <ProgressBar value={sol.progress} size="sm" showLabel={false} variant="stream" />
              </div>
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                {Math.round(sol.progress)}%
              </span>
            </div>
          </div>
        ))}
        {stream.inProgressSolutions.length > 3 && (
          <span className="text-xs text-muted-foreground">
            +{stream.inProgressSolutions.length - 3} more
          </span>
        )}
        {stream.inProgressSolutions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No active solutions</p>
        )}
      </div>
    </Card>
  );
}
