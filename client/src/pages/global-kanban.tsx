import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LayoutGrid } from "lucide-react";
import { KanbanBoard } from "@/components/kanban-board";
import { EmptyState } from "@/components/empty-state";
import { KanbanSkeleton } from "@/components/loading-skeleton";
import { apiRequest, queryClient, type ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ActionWithLastComment } from "@shared/schema";

interface GlobalKanbanProps {
  showDescriptions: boolean;
}

export function GlobalKanban({ showDescriptions }: GlobalKanbanProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: actions, isLoading } = useQuery<ActionWithLastComment[]>({
    queryKey: ["/api/actions"],
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
          description="Create actions in your solutions to see them here."
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
