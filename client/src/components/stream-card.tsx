import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MomentumBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import type { StreamWithProgress } from "@shared/schema";

interface StreamCardProps {
  stream: StreamWithProgress;
  onClick?: () => void;
  showDescription?: boolean;
}

export function StreamCard({ stream, onClick, showDescription = true }: StreamCardProps) {
  const isOverdue =
    stream.computedMilestoneDate &&
    new Date(stream.computedMilestoneDate) < new Date() &&
    stream.progress < 100;

  return (
    <Card
      className="p-4 space-y-3 cursor-pointer hover-elevate active-elevate-2 transition-shadow"
      onClick={onClick}
      data-testid={`card-stream-${stream.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base truncate" data-testid={`text-stream-name-${stream.id}`}>
            {stream.name}
          </h3>
          {showDescription && stream.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {stream.description}
            </p>
          )}
        </div>
        <MomentumBadge status={stream.momentumStatus} />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {stream.computedMilestoneDate && (
          <div
            className={`flex items-center gap-1 ${isOverdue ? "text-status-blocked" : ""}`}
          >
            <Calendar className="h-3 w-3" />
            <span className="font-mono">
              {format(new Date(stream.computedMilestoneDate), "MMM d, yyyy")}
            </span>
            {isOverdue && <span className="font-medium">Overdue</span>}
          </div>
        )}
        <span>|</span>
        <span>{stream.deliverableCount} Deliverables</span>
      </div>

      <ProgressBar value={stream.progress} />

      <div className="flex items-center gap-2 flex-wrap">
        {stream.doingCount > 0 && (
          <Badge variant="outline" className="text-xs bg-status-executing/10 text-status-executing border-status-executing/30">
            {stream.doingCount} Doing
          </Badge>
        )}
        {stream.blockedCount > 0 && (
          <Badge variant="outline" className="text-xs bg-status-blocked/10 text-status-blocked border-status-blocked/30">
            {stream.blockedCount} Blocked
          </Badge>
        )}
        {stream.delegatedCount > 0 && (
          <Badge variant="outline" className="text-xs bg-status-delegated/10 text-status-delegated border-status-delegated/30">
            {stream.delegatedCount} Delegated
          </Badge>
        )}
      </div>

      {stream.phases.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {stream.phases.slice(0, 2).map((phase) => (
            <Badge key={phase} variant="secondary" className="text-xs">
              {phase}
            </Badge>
          ))}
          {stream.phases.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{stream.phases.length - 2}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
