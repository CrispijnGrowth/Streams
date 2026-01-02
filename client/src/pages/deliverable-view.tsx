import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckSquare } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { KanbanBoard } from "@/components/kanban-board";
import { QuickAddForm } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { KanbanSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deliverable, ActionWithProgress } from "@shared/schema";

interface DeliverableViewProps {
  streamId: string;
  deliverableId: string;
  showDescriptions: boolean;
}

export function DeliverableView({ streamId, deliverableId, showDescriptions }: DeliverableViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: deliverable, isLoading: deliverableLoading } = useQuery<Deliverable>({
    queryKey: ["/api/deliverables", deliverableId],
  });

  const { data: actions, isLoading: actionsLoading } = useQuery<ActionWithProgress[]>({
    queryKey: ["/api/deliverables", deliverableId, "actions"],
  });

  const createAction = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/actions", { name, deliverableId, streamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverableId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Action created" });
    },
    onError: () => {
      toast({ title: "Failed to create action", variant: "destructive" });
    },
  });

  const updateActionStatus = useMutation({
    mutationFn: async ({ actionId, status }: { actionId: string; status: string }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverableId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const timelineItems = actions?.map((a) => ({
    id: a.id,
    title: a.name,
    description: a.description,
    date: a.dueDate,
    status: a.status,
    progress: a.progress,
  })) || [];

  const handleActionClick = (actionId: string) => {
    setLocation(`/stream/${streamId}/deliverable/${deliverableId}/action/${actionId}`);
  };

  const isLoading = deliverableLoading || actionsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-6">
          <KanbanSkeleton />
        </div>
        <div className="shrink-0 border-t p-4 bg-background">
          <TimelineSkeleton />
        </div>
      </div>
    );
  }

  if (!deliverable) {
    return (
      <div className="p-6">
        <EmptyState
          icon={CheckSquare}
          title="Deliverable not found"
          description="The deliverable you're looking for doesn't exist or has been deleted."
        />
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-6">
          <EmptyState
            icon={CheckSquare}
            title="No actions yet"
            description="Create your first action to start tracking work in this deliverable."
            actionLabel="Create Action"
            onAction={() => createAction.mutate("New Action")}
          />
        </div>
        <div className="shrink-0 border-t p-4 bg-background">
          <Timeline
            items={[]}
            onItemClick={handleActionClick}
            level="action"
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
            <h2 className="text-lg font-semibold">Actions Kanban</h2>
            <span className="text-sm text-muted-foreground">
              {actions.length} action{actions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <KanbanBoard
            actions={actions.filter((a) => !a.isDeleted)}
            onActionClick={handleActionClick}
            onStatusChange={(actionId, status) => updateActionStatus.mutate({ actionId, status })}
            showDescription={showDescriptions}
          />

          <div className="max-w-sm">
            <QuickAddForm
              placeholder="Add new action..."
              onAdd={(name) => createAction.mutate(name)}
              isLoading={createAction.isPending}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t p-4 bg-background">
        <Timeline
          items={timelineItems}
          onItemClick={handleActionClick}
          level="action"
          defaultWindowMonths={6}
        />
      </div>
    </div>
  );
}
