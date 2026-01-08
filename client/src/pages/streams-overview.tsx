import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layers, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ClassNavigator } from "@/components/class-navigator";
import { Timeline } from "@/components/timeline";
import { StreamCard } from "@/components/stream-card";
import { QuickAddForm, QuickAddFormRef } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { StreamCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { EditStreamDialog } from "@/components/edit-stream-dialog";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMode } from "@/lib/mode-context";
import type { StreamWithProgress, Stream, MomentumStatusType } from "@shared/schema";
import { SolutionStatus } from "@shared/schema";

type SortField = "ordinal" | "name" | "date" | "progress";
type SortDirection = "asc" | "desc";

interface StreamsOverviewProps {
  showDescriptions: boolean;
}

const sortLabels: Record<SortField, string> = {
  ordinal: "Default",
  name: "Name",
  date: "Milestone Date",
  progress: "Progress",
};

export function StreamsOverview({ showDescriptions }: StreamsOverviewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setAutoEditForEmptyState } = useMode();
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [sortField, setSortField] = useState<SortField>("ordinal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({
    owner: [],
    label: [],
    momentum: [],
  });
  const quickAddRef = useRef<QuickAddFormRef>(null);

  const { data: streams, isLoading: streamsLoading } = useQuery<StreamWithProgress[]>({
    queryKey: ["/api/streams"],
  });

  useEffect(() => {
    if (!streamsLoading && streams !== undefined) {
      const activeStreams = streams.filter((s) => !s.isDeleted);
      setAutoEditForEmptyState(activeStreams.length === 0);
    }
  }, [streams, streamsLoading, setAutoEditForEmptyState]);

  useKeyboardShortcuts([
    {
      key: "n",
      handler: useCallback(() => {
        quickAddRef.current?.focus();
      }, []),
      description: "Focus quick add input",
    },
  ]);

  const filterConfigs = useMemo(() => {
    if (!streams) return [];
    
    const owners = new Set<string>();
    const labels = new Set<string>();
    const momentums = new Set<string>();
    
    streams.filter((s) => !s.isDeleted).forEach((stream) => {
      stream.owners?.forEach((o) => owners.add(o));
      stream.labels?.forEach((l) => labels.add(l));
      if (stream.momentumStatus) momentums.add(stream.momentumStatus);
    });

    return [
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

  const filteredAndSortedStreams = useMemo(() => {
    if (!streams) return [];
    
    const filtered = streams.filter((stream) => {
      if (stream.isDeleted) return false;
      
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

    return filtered.sort((a, b) => {
      const aOnHold = a.status === SolutionStatus.ON_HOLD;
      const bOnHold = b.status === SolutionStatus.ON_HOLD;
      if (aOnHold !== bOnHold) {
        return aOnHold ? 1 : -1;
      }
      
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "date":
          const dateA = a.computedMilestoneDate ? new Date(a.computedMilestoneDate).getTime() : Infinity;
          const dateB = b.computedMilestoneDate ? new Date(b.computedMilestoneDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        case "progress":
          comparison = (a.progress || 0) - (b.progress || 0);
          break;
        case "ordinal":
        default:
          comparison = a.ordinal - b.ordinal;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [streams, activeFilters, sortField, sortDirection]);

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleFilterChange = (key: string, values: string[]) => {
    setActiveFilters((prev) => ({ ...prev, [key]: values }));
  };

  const handleClearFilters = () => {
    setActiveFilters({ owner: [], label: [], momentum: [] });
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

  const updateStreamMomentum = useMutation({
    mutationFn: async ({ streamId, momentumStatus }: { streamId: string; momentumStatus: MomentumStatusType }) => {
      return apiRequest("PATCH", `/api/streams/${streamId}`, { momentumStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const timelineItems = streams?.map((s) => {
    const drivingSolution = s.inProgressSolutions.find(sol => sol.isEarliest);
    return {
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
      type: "stream" as const,
      drivingSolutionName: drivingSolution?.name,
      isOnHold: s.status === SolutionStatus.ON_HOLD,
    };
  }) || [];

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
            <ClassNavigator currentLevel="portfolio" />
            <span className="text-sm text-muted-foreground">
              {filteredAndSortedStreams.length} of {streams?.filter((s) => !s.isDeleted).length || 0} stream{(streams?.filter((s) => !s.isDeleted).length || 0) !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            {filterConfigs.length > 0 && (
              <FilterBar
                filters={filterConfigs}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onClearAll={handleClearFilters}
              />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Sort by</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="sort-field">
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    {sortLabels[sortField]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={sortField}
                    onValueChange={(value) => setSortField(value as SortField)}
                  >
                    <DropdownMenuRadioItem value="ordinal">Default</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="date">Milestone Date</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="progress">Progress</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleSortDirection}
                data-testid="sort-direction"
              >
                {sortDirection === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedStreams.map((stream) => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  onClick={() => handleStreamClick(stream.id)}
                  onEdit={() => setEditingStream(stream)}
                  onMomentumClick={(newStatus) => updateStreamMomentum.mutate({ streamId: stream.id, momentumStatus: newStatus })}
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
              ref={quickAddRef}
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
