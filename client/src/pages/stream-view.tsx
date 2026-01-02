import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Users, Tag, Calendar, Activity } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { DeliverableCard } from "@/components/deliverable-card";
import { QuickAddForm } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { DeliverableCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Stream, DeliverableWithProgress } from "@shared/schema";

interface StreamViewProps {
  streamId: string;
  showDescriptions: boolean;
}

export function StreamView({ streamId, showDescriptions }: StreamViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: stream, isLoading: streamLoading } = useQuery<Stream>({
    queryKey: ["/api/streams", streamId],
  });

  const { data: deliverables, isLoading: deliverablesLoading } = useQuery<DeliverableWithProgress[]>({
    queryKey: ["/api/streams", streamId, "deliverables"],
  });

  const createDeliverable = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/deliverables", { name, streamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams", streamId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Deliverable created" });
    },
    onError: () => {
      toast({ title: "Failed to create deliverable", variant: "destructive" });
    },
  });

  const timelineItems = deliverables?.map((d) => ({
    id: d.id,
    title: d.name,
    description: d.description,
    date: d.milestoneDate,
    status: d.status,
    progress: d.progress,
    counts: {
      doing: d.doingCount,
      blocked: d.blockedCount,
      delegated: d.delegatedCount,
    },
  })) || [];

  const handleDeliverableClick = (deliverableId: string) => {
    setLocation(`/stream/${streamId}/deliverable/${deliverableId}`);
  };

  const isLoading = streamLoading || deliverablesLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <DeliverableCardSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t p-4 bg-background">
          <TimelineSkeleton />
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Stream not found"
          description="The stream you're looking for doesn't exist or has been deleted."
        />
      </div>
    );
  }

  if (!deliverables || deliverables.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-6">
          <EmptyState
            icon={Package}
            title="No deliverables yet"
            description="Create your first deliverable to start tracking progress in this stream."
            actionLabel="Create Deliverable"
            onAction={() => createDeliverable.mutate("New Deliverable")}
          />
        </div>
        <div className="shrink-0 border-t p-4 bg-background">
          <Timeline
            items={[]}
            onItemClick={handleDeliverableClick}
            level="deliverable"
          />
        </div>
      </div>
    );
  }

  const getMomentumColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "Slowing": return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "Stalled": return "bg-red-500/10 text-red-700 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="space-y-3 pb-4 border-b">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground" data-testid="text-stream-key">{stream.key}</span>
                  {stream.momentumStatus && (
                    <Badge variant="secondary" className={getMomentumColor(stream.momentumStatus)}>
                      <Activity className="w-3 h-3 mr-1" />
                      {stream.momentumStatus}
                    </Badge>
                  )}
                </div>
                <h1 className="text-xl font-semibold" data-testid="text-stream-name">{stream.name}</h1>
              </div>
              {stream.computedMilestoneDate && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Milestone: {new Date(stream.computedMilestoneDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {showDescriptions && stream.description && (
              <p className="text-sm text-muted-foreground max-w-3xl" data-testid="text-stream-description">
                {stream.description}
              </p>
            )}

            <div className="flex items-center gap-4 flex-wrap text-sm">
              {stream.owners && stream.owners.length > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{stream.owners.join(", ")}</span>
                </div>
              )}
              {stream.phases && stream.phases.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {stream.phases.map((phase) => (
                    <Badge key={phase} variant="outline" className="text-xs">
                      {phase}
                    </Badge>
                  ))}
                </div>
              )}
              {stream.labels && stream.labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {stream.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Deliverables</h2>
              <span className="text-sm text-muted-foreground">
                {deliverables.length} deliverable{deliverables.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {deliverables
                .filter((d) => !d.isDeleted)
                .sort((a, b) => a.ordinal - b.ordinal)
                .map((deliverable) => (
                  <DeliverableCard
                    key={deliverable.id}
                    deliverable={deliverable}
                    onClick={() => handleDeliverableClick(deliverable.id)}
                    showDescription={showDescriptions}
                  />
                ))}
            </div>

            <div className="max-w-sm">
              <QuickAddForm
                placeholder="Add new deliverable..."
                onAdd={(name) => createDeliverable.mutate(name)}
                isLoading={createDeliverable.isPending}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t p-4 bg-background">
        <Timeline
          items={timelineItems}
          onItemClick={handleDeliverableClick}
          level="deliverable"
          defaultWindowMonths={12}
        />
      </div>
    </div>
  );
}
