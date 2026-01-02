import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { DeliverableCard } from "@/components/deliverable-card";
import { QuickAddForm } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { DeliverableCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
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
