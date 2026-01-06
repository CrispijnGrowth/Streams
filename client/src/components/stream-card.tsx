import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MomentumBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar, Pencil } from "lucide-react";
import { format } from "date-fns";
import type { StreamWithProgress, MomentumStatusType } from "@shared/schema";

interface StreamCardProps {
  stream: StreamWithProgress;
  onClick?: () => void;
  onEdit?: () => void;
  onMomentumClick?: (newStatus: MomentumStatusType) => void;
  showDescription?: boolean;
}

export function StreamCard({ stream, onClick, onEdit, onMomentumClick, showDescription = true }: StreamCardProps) {
  const isOverdue =
    stream.computedMilestoneDate &&
    new Date(stream.computedMilestoneDate) < new Date() &&
    stream.progress < 100;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleMomentumClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onMomentumClick) return;
    
    // Cycle through: Active -> Slowing -> Stalled -> Active
    const nextStatus: Record<MomentumStatusType, MomentumStatusType> = {
      Active: "Slowing",
      Slowing: "Stalled",
      Stalled: "Active",
    };
    onMomentumClick(nextStatus[stream.momentumStatus]);
  };

  return (
    <Card
      className="p-4 space-y-3 cursor-pointer hover-elevate active-elevate-2 transition-shadow group shadow-sm border-2 border-[#0066FF]"
      onClick={onClick}
      data-testid={`card-stream-${stream.id}`}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-base truncate flex-1" data-testid={`text-stream-name-${stream.id}`}>
            {stream.name}
          </h3>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={handleEdit}
            data-testid={`button-edit-stream-${stream.id}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      {showDescription && stream.description && (
        <p className="text-xs text-muted-foreground line-clamp-1">
          {stream.description}
        </p>
      )}

      <div className="space-y-2">
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
