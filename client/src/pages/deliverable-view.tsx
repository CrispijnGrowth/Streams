import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckSquare, Users, Tag, Calendar, Pencil } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { KanbanBoard } from "@/components/kanban-board";
import { QuickAddForm } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { KanbanSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDeliverableDialog } from "@/components/edit-deliverable-dialog";
import { EditActionDialog } from "@/components/edit-action-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DeliverableWithProgress, ActionWithProgress, Action } from "@shared/schema";

interface DeliverableViewProps {
  streamId: string;
  deliverableId: string;
  showDescriptions: boolean;
}

export function DeliverableView({ streamId, deliverableId, showDescriptions }: DeliverableViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingDeliverable, setEditingDeliverable] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);

  const { data: deliverable, isLoading: deliverableLoading } = useQuery<DeliverableWithProgress>({
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

  const updateActionOrder = useMutation({
    mutationFn: async ({ actionId, kanbanOrder }: { actionId: string; kanbanOrder: number }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { kanbanOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverableId, "actions"] });
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
        <div className="space-y-6">
          <div className="space-y-3 pb-4 border-b">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground" data-testid="text-deliverable-key">{deliverable.key}</span>
                  <StatusBadge status={deliverable.status} />
                </div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold" data-testid="text-deliverable-name">{deliverable.name}</h1>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingDeliverable(true)}
                    data-testid="button-edit-deliverable"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {deliverable.milestoneDate && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Due: {new Date(deliverable.milestoneDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {showDescriptions && deliverable.description && (
              <p className="text-sm text-muted-foreground max-w-3xl" data-testid="text-deliverable-description">
                {deliverable.description}
              </p>
            )}

            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-32">
                <ProgressBar value={deliverable.progress || 0} size="sm" showLabel={false} />
              </div>
              <span className="text-sm text-muted-foreground">{deliverable.progress || 0}% complete</span>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-sm">
              {deliverable.owners && deliverable.owners.length > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{deliverable.owners.join(", ")}</span>
                </div>
              )}
              {deliverable.phases && deliverable.phases.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {deliverable.phases.map((phase) => (
                    <Badge key={phase} variant="outline" className="text-xs">
                      {phase}
                    </Badge>
                  ))}
                </div>
              )}
              {deliverable.labels && deliverable.labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {deliverable.labels.map((label) => (
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
              <h2 className="text-lg font-semibold">Actions Kanban</h2>
              <span className="text-sm text-muted-foreground">
                {actions.length} action{actions.length !== 1 ? "s" : ""}
              </span>
            </div>

            <KanbanBoard
              actions={actions.filter((a) => !a.isDeleted)}
              onActionClick={handleActionClick}
              onActionEdit={(action) => setEditingAction(action)}
              onStatusChange={(actionId, status) => updateActionStatus.mutate({ actionId, status })}
              onReorder={(actionId, kanbanOrder) => updateActionOrder.mutate({ actionId, kanbanOrder })}
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
      </div>

      <div className="shrink-0 border-t p-4 bg-background">
        <Timeline
          items={timelineItems}
          onItemClick={handleActionClick}
          level="action"
          defaultWindowMonths={6}
        />
      </div>

      <EditDeliverableDialog
        deliverable={deliverable}
        open={editingDeliverable}
        onOpenChange={setEditingDeliverable}
        onDeleted={() => setLocation(`/stream/${streamId}`)}
      />

      <EditActionDialog
        action={editingAction}
        open={editingAction !== null}
        onOpenChange={(open) => !open && setEditingAction(null)}
      />
    </div>
  );
}
