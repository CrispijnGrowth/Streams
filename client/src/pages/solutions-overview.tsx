import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layers } from "lucide-react";
import { ClassNavigator } from "@/components/class-navigator";
import { Timeline } from "@/components/timeline";
import { SolutionCard } from "@/components/solution-card";
import { EmptyState } from "@/components/empty-state";
import { SolutionCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { EditSolutionDialog } from "@/components/edit-solution-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SolutionWithBreakdownAndComment, StreamWithProgress } from "@shared/schema";

interface SolutionsOverviewProps {
  showDescriptions: boolean;
}

export function SolutionsOverview({ showDescriptions }: SolutionsOverviewProps) {
  const [, setLocation] = useLocation();
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [editingSolution, setEditingSolution] = useState<SolutionWithBreakdownAndComment | null>(null);

  const { data: solutions, isLoading: solutionsLoading } = useQuery<SolutionWithBreakdownAndComment[]>({
    queryKey: ["/api/solutions/all-with-breakdown"],
  });

  const { data: streams } = useQuery<StreamWithProgress[]>({
    queryKey: ["/api/streams"],
  });

  const streamMap = useMemo(() => {
    const map = new Map<string, StreamWithProgress>();
    streams?.forEach((s) => map.set(s.id, s));
    return map;
  }, [streams]);

  const filteredAndSortedSolutions = useMemo(() => {
    if (!solutions) return [];

    let filtered = solutions.filter((s) => !s.isDeleted);

    if (priorityFilter !== "all") {
      if (priorityFilter === "none") {
        filtered = filtered.filter((s) => !s.priority);
      } else {
        const prio = parseInt(priorityFilter);
        filtered = filtered.filter((s) => s.priority === prio);
      }
    }

    return filtered.sort((a, b) => {
      const prioA = a.priority ?? 999;
      const prioB = b.priority ?? 999;
      if (prioA !== prioB) return prioA - prioB;
      
      if (a.milestoneDate && b.milestoneDate) {
        return new Date(a.milestoneDate).getTime() - new Date(b.milestoneDate).getTime();
      }
      if (a.milestoneDate) return -1;
      if (b.milestoneDate) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [solutions, priorityFilter]);

  const timelineItems = useMemo(() => {
    return filteredAndSortedSolutions.map((solution) => {
      const stream = streamMap.get(solution.streamId);
      return {
        id: solution.id,
        title: solution.name,
        description: solution.description || undefined,
        date: solution.milestoneDate || undefined,
        momentumStatus: solution.momentumStatus,
        progress: solution.progress,
        type: "solution" as const,
        parentId: solution.streamId,
        parentName: stream?.name,
        isOnHold: solution.status === "On Hold",
        counts: {
          doing: solution.doingCount,
          blocked: solution.blockedCount,
          delegated: solution.delegatedCount,
        },
      };
    });
  }, [filteredAndSortedSolutions, streamMap]);

  const handleSolutionClick = (solution: SolutionWithBreakdownAndComment) => {
    setLocation(`/stream/${solution.streamId}/solution/${solution.id}`);
  };

  const priorityCounts = useMemo(() => {
    if (!solutions) return { none: 0 };
    const counts: Record<string, number> = { none: 0 };
    solutions.filter((s) => !s.isDeleted).forEach((s) => {
      if (s.priority) {
        counts[s.priority] = (counts[s.priority] || 0) + 1;
      } else {
        counts.none = (counts.none || 0) + 1;
      }
    });
    return counts;
  }, [solutions]);

  if (solutionsLoading) {
    return (
      <div className="flex flex-col h-full p-6 space-y-4">
        <ClassNavigator currentLevel="solution" />
        <TimelineSkeleton />
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-4">
              <SolutionCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeSolutions = solutions?.filter((s) => !s.isDeleted) || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <ClassNavigator currentLevel="solution" />
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold" data-testid="heading-solutions-overview">
                All Solutions
              </h1>
              <span className="text-sm text-muted-foreground">
                ({filteredAndSortedSolutions.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by Priority:</span>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="1">
                  Prio 1 {priorityCounts[1] ? `(${priorityCounts[1]})` : ""}
                </SelectItem>
                <SelectItem value="2">
                  Prio 2 {priorityCounts[2] ? `(${priorityCounts[2]})` : ""}
                </SelectItem>
                <SelectItem value="3">
                  Prio 3 {priorityCounts[3] ? `(${priorityCounts[3]})` : ""}
                </SelectItem>
                <SelectItem value="4">
                  Prio 4 {priorityCounts[4] ? `(${priorityCounts[4]})` : ""}
                </SelectItem>
                <SelectItem value="5">
                  Prio 5 {priorityCounts[5] ? `(${priorityCounts[5]})` : ""}
                </SelectItem>
                <SelectItem value="none">
                  No Priority {priorityCounts.none ? `(${priorityCounts.none})` : ""}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredAndSortedSolutions.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={priorityFilter !== "all" ? "No solutions with this priority" : "No solutions yet"}
            description={
              priorityFilter !== "all"
                ? "Try selecting a different priority filter or create solutions with this priority level."
                : "Solutions will appear here once you create them in your streams."
            }
          />
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {filteredAndSortedSolutions.map((solution) => {
              const stream = streamMap.get(solution.streamId);
              return (
                <div key={solution.id} className="break-inside-avoid mb-4">
                  <SolutionCard
                    solution={solution}
                    onClick={() => handleSolutionClick(solution)}
                    onEdit={() => setEditingSolution(solution)}
                    showDescription={showDescriptions}
                    streamName={stream?.name}
                    onStreamClick={() => stream && setLocation(`/stream/${stream.id}`)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {filteredAndSortedSolutions.length > 0 && (
          <Timeline
            items={timelineItems}
            onItemClick={(id) => {
              const solution = filteredAndSortedSolutions.find((s) => s.id === id);
              if (solution) handleSolutionClick(solution);
            }}
            level="solution"
            showNoDateShelf={true}
          />
        )}
      </div>

      {editingSolution && (
        <EditSolutionDialog
          solution={editingSolution}
          open={!!editingSolution}
          onOpenChange={(open) => !open && setEditingSolution(null)}
        />
      )}
    </div>
  );
}
