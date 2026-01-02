import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layers } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { StreamCard } from "@/components/stream-card";
import { QuickAddForm } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { StreamCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { EditStreamDialog } from "@/components/edit-stream-dialog";
import { FilterBar } from "@/components/filter-bar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StreamWithProgress, Stream, MomentumStatus } from "@shared/schema";

interface StreamsOverviewProps {
  showDescriptions: boolean;
}

export function StreamsOverview({ showDescriptions }: StreamsOverviewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({
    phase: [],
    owner: [],
    label: [],
    momentum: [],
  });

  const { data: streams, isLoading: streamsLoading } = useQuery<StreamWithProgress[]>({
    queryKey: ["/api/streams"],
  });

  const filterConfigs = useMemo(() => {
    if (!streams) return [];
    
    const phases = new Set<string>();
    const owners = new Set<string>();
    const labels = new Set<string>();
    const momentums = new Set<string>();
    
    streams.filter((s) => !s.isDeleted).forEach((stream) => {
      stream.phases?.forEach((p) => phases.add(p));
      stream.owners?.forEach((o) => owners.add(o));
      stream.labels?.forEach((l) => labels.add(l));
      if (stream.momentumStatus) momentums.add(stream.momentumStatus);
    });

    return [
      {
        key: "phase",
        label: "Phase",
        options: Array.from(phases).sort().map((p) => ({ value: p, label: p })),
      },
      {
        key: "owner",
        label: "Owner",
        options: Array.from(owners).sort().map((o) => ({ value: o, label: o })),
      },
      {
        key: "label",
        label: "Label",
        options: Array.from(labels).sort().map((l) => ({ value: l, label: l })),
      },
      {
        key: "momentum",
        label: "Momentum",
        options: Array.from(momentums).map((m) => ({ value: m, label: m })),
      },
    ];
  }, [streams]);

  const filteredStreams = useMemo(() => {
    if (!streams) return [];
    
    return streams.filter((stream) => {
      if (stream.isDeleted) return false;
      
      if (activeFilters.phase.length > 0) {
        if (!stream.phases?.some((p) => activeFilters.phase.includes(p))) return false;
      }
      if (activeFilters.owner.length > 0) {
        if (!stream.owners?.some((o) => activeFilters.owner.includes(o))) return false;
      }
      if (activeFilters.label.length > 0) {
        if (!stream.labels?.some((l) => activeFilters.label.includes(l))) return false;
      }
      if (activeFilters.momentum.length > 0) {
        if (!stream.momentumStatus || !activeFilters.momentum.includes(stream.momentumStatus)) return false;
      }
      
      return true;
    });
  }, [streams, activeFilters]);

  const handleFilterChange = (key: string, values: string[]) => {
    setActiveFilters((prev) => ({ ...prev, [key]: values }));
  };

  const handleClearFilters = () => {
    setActiveFilters({ phase: [], owner: [], label: [], momentum: [] });
  };

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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">All Streams</h2>
            <span className="text-sm text-muted-foreground">
              {filteredStreams.length} of {streams?.filter((s) => !s.isDeleted).length || 0} stream{(streams?.filter((s) => !s.isDeleted).length || 0) !== 1 ? "s" : ""}
            </span>
          </div>

          {filterConfigs.length > 0 && (
            <FilterBar
              filters={filterConfigs}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearFilters}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStreams
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
