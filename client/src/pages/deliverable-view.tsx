import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckSquare, Users, Tag, Calendar, Pencil } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { KanbanBoard } from "@/components/kanban-board";
import { QuickAddForm, QuickAddFormRef } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { KanbanSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDeliverableDialog } from "@/components/edit-deliverable-dialog";
import { EditActionDialog } from "@/components/edit-action-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { DeliverableWithProgress, ActionWithProgress, Action } from "@shared/schema";
import { DeliverableStatus } from "@shared/schema";

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
  const quickAddRef = useRef<QuickAddFormRef>(null);

  const { data: deliverable, isLoading: deliverableLoading } = useQuery<DeliverableWithProgress>({
    queryKey: ["/api/deliverables", deliverableId],
  });

  const { data: actions, isLoading: actionsLoading } = useQuery<ActionWithProgress[]>({
    queryKey: ["/api/deliverables", deliverableId, "actions"],
  });

  const deleteDeliverable = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/deliverables/${deliverableId}`, { isDeleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Deliverable moved to recycle bin" });
      setLocation(`/stream/${streamId}`);
    },
    onError: () => {
      toast({ title: "Failed to delete deliverable", variant: "destructive" });
    },
  });

  useKeyboardShortcuts([
    {
      key: "n",
      handler: useCallback(() => {
        quickAddRef.current?.focus();
      }, []),
      description: "Focus quick add input",
    },
    {
      key: "e",
      handler: useCallback(() => {
        if (deliverable) {
          setEditingDeliverable(true);
        }
      }, [deliverable]),
      description: "Edit current deliverable",
    },
    {
      key: "Delete",
      handler: useCallback(() => {
        if (deliverable && !deliverable.isDeleted) {
          deleteDeliverable.mutate();
        }
      }, [deliverable]),
      description: "Delete current deliverable",
    },
  ]);

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

  const updateDeliverableStatus = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/deliverables/${deliverableId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverableId] });
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

  const updateActionDate = useMutation({
    mutationFn: async ({ actionId, dueDate }: { actionId: string; dueDate: string }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { dueDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverableId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
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
          <div className="flex items-center justify-between gap-4 pb-3 border-b flex-wrap">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold" data-testid="text-deliverable-name">{deliverable.name}</h1>
              <Button
                size="sm"
                variant={deliverable.status === DeliverableStatus.ON_HOLD ? "secondary" : "outline"}
                onClick={() => {
                  const newStatus = deliverable.status === DeliverableStatus.ON_HOLD 
                    ? DeliverableStatus.IN_PROGRESS 
                    : DeliverableStatus.ON_HOLD;
                  updateDeliverableStatus.mutate(newStatus);
                }}
                data-testid="button-toggle-deliverable-status"
              >
                {deliverable.status === DeliverableStatus.ON_HOLD ? "On Hold" : "In Progress"}
              </Button>
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
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {deliverable.milestoneDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(deliverable.milestoneDate).toLocaleDateString()}</span>
                </div>
              )}
              {deliverable.owners && deliverable.owners.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{deliverable.owners.join(", ")}</span>
                </div>
              )}
              {deliverable.labels && deliverable.labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-4 h-4" />
                  {deliverable.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">

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
                ref={quickAddRef}
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
          onDateChange={(id, newDate) => updateActionDate.mutate({ actionId: id, dueDate: newDate })}
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
