import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layers } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { StreamCard } from "@/components/stream-card";
import { QuickAddForm } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { StreamCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { EditStreamDialog } from "@/components/edit-stream-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StreamWithProgress, Stream } from "@shared/schema";

interface StreamsOverviewProps {
  showDescriptions: boolean;
}

export function StreamsOverview({ showDescriptions }: StreamsOverviewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingStream, setEditingStream] = useState<Stream | null>(null);

  const { data: streams, isLoading: streamsLoading } = useQuery<StreamWithProgress[]>({
    queryKey: ["/api/streams"],
  });

  const createStream = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/streams", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Stream created" });
    },
    onError: () => {
      toast({ title: "Failed to create stream", variant: "destructive" });
    },
  });

  const timelineItems = streams?.map((s) => ({
    id: s.id,
    title: s.name,
    description: s.description,
    date: s.computedMilestoneDate,
    momentumStatus: s.momentumStatus,
    progress: s.progress,
    counts: {
      doing: s.doingCount,
      blocked: s.blockedCount,
      delegated: s.delegatedCount,
    },
  })) || [];

  const handleStreamClick = (streamId: string) => {
    setLocation(`/stream/${streamId}`);
  };

  const handleTimelineItemClick = (streamId: string) => {
    setLocation(`/stream/${streamId}`);
  };

  if (streamsLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <StreamCardSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t p-4 bg-background">
          <TimelineSkeleton />
        </div>
      </div>
    );
  }

  if (!streams || streams.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Layers}
          title="No streams yet"
          description="Get started by creating your first stream to organize your work."
          actionLabel="Create Stream"
          onAction={() => createStream.mutate("New Stream")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">All Streams</h2>
            <span className="text-sm text-muted-foreground">
              {streams.length} stream{streams.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streams
              .filter((s) => !s.isDeleted)
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((stream) => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  onClick={() => handleStreamClick(stream.id)}
                  onEdit={() => setEditingStream(stream)}
                  showDescription={showDescriptions}
                />
              ))}
          </div>

          <EditStreamDialog
            stream={editingStream}
            open={editingStream !== null}
            onOpenChange={(open) => !open && setEditingStream(null)}
          />

          <div className="max-w-sm">
            <QuickAddForm
              placeholder="Add new stream..."
              onAdd={(name) => createStream.mutate(name)}
              isLoading={createStream.isPending}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t p-4 bg-background">
        <Timeline
          items={timelineItems}
          onItemClick={handleTimelineItemClick}
          level="stream"
          defaultWindowMonths={12}
        />
      </div>
    </div>
  );
}
