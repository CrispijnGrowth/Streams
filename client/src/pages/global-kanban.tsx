import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LayoutGrid, SlidersHorizontal, X } from "lucide-react";
import { useState, useMemo } from "react";
import { KanbanBoard } from "@/components/kanban-board";
import { EmptyState } from "@/components/empty-state";
import { KanbanSkeleton } from "@/components/loading-skeleton";
import { apiRequest, queryClient, type ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionWithLastComment, Stream, Solution, Deliverable } from "@shared/schema";

interface GlobalKanbanProps {
  showDescriptions: boolean;
}

const ALL_VALUE = "__all__";

export function GlobalKanban({ showDescriptions }: GlobalKanbanProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [ownerFilter, setOwnerFilter] = useState(ALL_VALUE);
  const [streamFilter, setStreamFilter] = useState(ALL_VALUE);
  const [solutionFilter, setSolutionFilter] = useState(ALL_VALUE);
  const [deliverableFilter, setDeliverableFilter] = useState(ALL_VALUE);

  const { data: actions, isLoading: actionsLoading } = useQuery<ActionWithLastComment[]>({
    queryKey: ["/api/actions"],
  });

  const { data: streams } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
  });

  const { data: solutions } = useQuery<Solution[]>({
    queryKey: ["/api/solutions"],
  });

  const { data: deliverables } = useQuery<Deliverable[]>({
    queryKey: ["/api/deliverables"],
  });

  const updateActionStatus = useMutation({
    mutationFn: async ({ actionId, status }: { actionId: string; status: string }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
    onError: (error: ApiError) => {
      toast({ title: error.message || "Failed to update action status", variant: "destructive" });
    },
  });

  const updateActionOrder = useMutation({
    mutationFn: async ({ actionId, kanbanOrder }: { actionId: string; kanbanOrder: number }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { kanbanOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
    },
    onError: (error: ApiError) => {
      toast({ title: error.message || "Failed to reorder action", variant: "destructive" });
    },
  });

  const handleActionClick = (actionId: string) => {
    const action = actions?.find((a) => a.id === actionId);
    if (action) {
      setLocation(`/stream/${action.streamId}/solution/${action.solutionId}/action/${actionId}`);
    }
  };

  const allOwners = useMemo(() => {
    if (!actions) return [];
    const ownerSet = new Set<string>();
    actions.forEach((a) => {
      if (!a.isDeleted) a.owners?.forEach((o) => ownerSet.add(o));
    });
    return Array.from(ownerSet).sort();
  }, [actions]);

  const filteredSolutions = useMemo(() => {
    if (!solutions) return [];
    if (streamFilter === ALL_VALUE) return solutions;
    return solutions.filter((s) => s.streamId === streamFilter);
  }, [solutions, streamFilter]);

  const filteredDeliverables = useMemo(() => {
    if (!deliverables) return [];
    if (solutionFilter !== ALL_VALUE) {
      return deliverables.filter((d) => d.solutionId === solutionFilter);
    }
    if (streamFilter !== ALL_VALUE) {
      const solutionIds = new Set(filteredSolutions.map((s) => s.id));
      return deliverables.filter((d) => solutionIds.has(d.solutionId));
    }
    return deliverables;
  }, [deliverables, solutionFilter, streamFilter, filteredSolutions]);

  const filteredActions = useMemo(() => {
    if (!actions) return [];
    return actions.filter((a) => {
      if (a.isDeleted) return false;
      if (streamFilter !== ALL_VALUE && a.streamId !== streamFilter) return false;
      if (solutionFilter !== ALL_VALUE && a.solutionId !== solutionFilter) return false;
      if (deliverableFilter !== ALL_VALUE) {
        if (deliverableFilter === "__none__") {
          if (a.deliverableId) return false;
        } else {
          if (a.deliverableId !== deliverableFilter) return false;
        }
      }
      if (ownerFilter !== ALL_VALUE && !a.owners?.includes(ownerFilter)) return false;
      return true;
    });
  }, [actions, streamFilter, solutionFilter, deliverableFilter, ownerFilter]);

  const hasActiveFilters =
    ownerFilter !== ALL_VALUE ||
    streamFilter !== ALL_VALUE ||
    solutionFilter !== ALL_VALUE ||
    deliverableFilter !== ALL_VALUE;

  const clearFilters = () => {
    setOwnerFilter(ALL_VALUE);
    setStreamFilter(ALL_VALUE);
    setSolutionFilter(ALL_VALUE);
    setDeliverableFilter(ALL_VALUE);
  };

  const handleStreamFilterChange = (value: string) => {
    setStreamFilter(value);
    setSolutionFilter(ALL_VALUE);
    setDeliverableFilter(ALL_VALUE);
  };

  const handleSolutionFilterChange = (value: string) => {
    setSolutionFilter(value);
    setDeliverableFilter(ALL_VALUE);
  };

  const totalActions = actions?.filter((a) => !a.isDeleted).length ?? 0;

  if (actionsLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Global Kanban</h1>
          <p className="text-sm text-muted-foreground mt-1">All actions across all streams</p>
        </div>
        <KanbanSkeleton />
      </div>
    );
  }

  if (!actions || totalActions === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Global Kanban</h1>
          <p className="text-sm text-muted-foreground mt-1">All actions across all streams</p>
        </div>
        <EmptyState
          icon={LayoutGrid}
          title="No actions yet"
          description="Create actions in your solutions to see them here."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Global Kanban</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? `${filteredActions.length} of ${totalActions} action${totalActions !== 1 ? "s" : ""} (filtered)`
              : `${totalActions} action${totalActions !== 1 ? "s" : ""} across all streams`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />

          {/* Stream filter */}
          <Select value={streamFilter} onValueChange={handleStreamFilterChange}>
            <SelectTrigger
              className="h-8 text-xs w-[140px]"
              data-testid="select-filter-stream"
            >
              <SelectValue placeholder="Stream" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Streams</SelectItem>
              {streams?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Solution filter */}
          <Select value={solutionFilter} onValueChange={handleSolutionFilterChange}>
            <SelectTrigger
              className="h-8 text-xs w-[150px]"
              data-testid="select-filter-solution"
            >
              <SelectValue placeholder="Solution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Solutions</SelectItem>
              {filteredSolutions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Deliverable filter */}
          <Select value={deliverableFilter} onValueChange={setDeliverableFilter}>
            <SelectTrigger
              className="h-8 text-xs w-[150px]"
              data-testid="select-filter-deliverable"
            >
              <SelectValue placeholder="Deliverable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Deliverables</SelectItem>
              <SelectItem value="__none__">Ungrouped</SelectItem>
              {filteredDeliverables.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Owner filter */}
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger
              className="h-8 text-xs w-[140px]"
              data-testid="select-filter-owner"
            >
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Owners</SelectItem>
              {allOwners.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {owner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground gap-1"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {filteredActions.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No actions match your filters"
          description="Try adjusting or clearing the filters above."
        />
      ) : (
        <KanbanBoard
          actions={filteredActions}
          onActionClick={handleActionClick}
          onStatusChange={(actionId, status) => updateActionStatus.mutate({ actionId, status })}
          onReorder={(actionId, kanbanOrder) => updateActionOrder.mutate({ actionId, kanbanOrder })}
          showDescription={showDescriptions}
        />
      )}
    </div>
  );
}
