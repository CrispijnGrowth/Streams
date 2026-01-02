import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LayoutGrid } from "lucide-react";
import { KanbanBoard } from "@/components/kanban-board";
import { EmptyState } from "@/components/empty-state";
import { KanbanSkeleton } from "@/components/loading-skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ActionWithProgress } from "@shared/schema";

interface GlobalKanbanProps {
  showDescriptions: boolean;
}

export function GlobalKanban({ showDescriptions }: GlobalKanbanProps) {
  const [, setLocation] = useLocation();

  const { data: actions, isLoading } = useQuery<ActionWithProgress[]>({
    queryKey: ["/api/actions"],
  });

  const updateActionStatus = useMutation({
    mutationFn: async ({ actionId, status }: { actionId: string; status: string }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const updateActionOrder = useMutation({
    mutationFn: async ({ actionId, kanbanOrder }: { actionId: string; kanbanOrder: number }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { kanbanOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
    },
  });

  const handleActionClick = (actionId: string) => {
    const action = actions?.find((a) => a.id === actionId);
    if (action) {
      setLocation(`/stream/${action.streamId}/deliverable/${action.deliverableId}/action/${actionId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Global Kanban</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All actions across all streams
          </p>
        </div>
        <KanbanSkeleton />
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Global Kanban</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All actions across all streams
          </p>
        </div>
        <EmptyState
          icon={LayoutGrid}
          title="No actions yet"
          description="Create actions in your deliverables to see them here."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Global Kanban</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {actions.length} action{actions.length !== 1 ? "s" : ""} across all streams
        </p>
      </div>

      <KanbanBoard
        actions={actions.filter((a) => !a.isDeleted)}
        onActionClick={handleActionClick}
        onStatusChange={(actionId, status) => updateActionStatus.mutate({ actionId, status })}
        onReorder={(actionId, kanbanOrder) => updateActionOrder.mutate({ actionId, kanbanOrder })}
        showDescription={showDescriptions}
      />
    </div>
  );
}
