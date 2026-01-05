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
import { EditSolutionDialog } from "@/components/edit-solution-dialog";
import { EditActionDialog } from "@/components/edit-action-dialog";
import { EditDeliverablePopup } from "@/components/edit-deliverable-popup";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMode } from "@/lib/mode-context";
import type { SolutionWithProgress, ActionWithProgress, Action, Deliverable, ActionStatusType, DeliverableBorderColorType } from "@shared/schema";
import { SolutionStatus, ActionStatus } from "@shared/schema";

interface SolutionViewProps {
  streamId: string;
  solutionId: string;
  showDescriptions: boolean;
}

export function SolutionView({ streamId, solutionId, showDescriptions }: SolutionViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isEditMode } = useMode();
  const [editingSolution, setEditingSolution] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [pendingActionStatus, setPendingActionStatus] = useState<ActionStatusType | null>(null);
  const [pendingDeliverableId, setPendingDeliverableId] = useState<string | undefined>(undefined);
  const quickAddRef = useRef<QuickAddFormRef>(null);

  const { data: solution, isLoading: solutionLoading } = useQuery<SolutionWithProgress>({
    queryKey: ["/api/solutions", solutionId],
  });

  const { data: actions, isLoading: actionsLoading } = useQuery<ActionWithProgress[]>({
    queryKey: ["/api/solutions", solutionId, "actions"],
  });

  const { data: deliverables, isLoading: deliverablesLoading } = useQuery<Deliverable[]>({
    queryKey: ["/api/solutions", solutionId, "deliverables"],
  });

  const deleteSolution = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/solutions/${solutionId}`, { isDeleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Solution moved to recycle bin" });
      setLocation(`/stream/${streamId}`);
    },
    onError: () => {
      toast({ title: "Failed to delete solution", variant: "destructive" });
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
        if (solution) {
          setEditingSolution(true);
        }
      }, [solution]),
      description: "Edit current solution",
    },
    {
      key: "Delete",
      handler: useCallback(() => {
        if (solution && !solution.isDeleted) {
          deleteSolution.mutate();
        }
      }, [solution]),
      description: "Delete current solution",
    },
  ]);

  const createAction = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/actions", { name, solutionId, streamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const updateSolutionStatus = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/solutions/${solutionId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const updateActionOrder = useMutation({
    mutationFn: async ({ actionId, kanbanOrder }: { actionId: string; kanbanOrder: number }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { kanbanOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
    },
  });

  const updateDeliverableOrdinal = useMutation({
    mutationFn: async ({ deliverableId, ordinal }: { deliverableId: string; ordinal: number }) => {
      return apiRequest("PATCH", `/api/deliverables/${deliverableId}`, { ordinal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "deliverables"] });
    },
  });

  const updateActionDeliverable = useMutation({
    mutationFn: async ({ actionId, deliverableId }: { actionId: string; deliverableId: string | null }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { deliverableId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "deliverables"] });
    },
  });

  const updateActionDate = useMutation({
    mutationFn: async ({ actionId, dueDate }: { actionId: string; dueDate: string }) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, { dueDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
    },
  });

  const createDeliverable = useMutation({
    mutationFn: async ({ name, borderColor }: { name: string; borderColor: DeliverableBorderColorType }) => {
      return apiRequest("POST", "/api/deliverables", { name, solutionId, streamId, borderColor, owners: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      toast({ title: "Deliverable created" });
    },
    onError: () => {
      toast({ title: "Failed to create deliverable", variant: "destructive" });
    },
  });

  const updateDeliverable = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; borderColor: DeliverableBorderColorType; owners: string[] } }) => {
      return apiRequest("PATCH", `/api/deliverables/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      toast({ title: "Deliverable updated" });
    },
    onError: () => {
      toast({ title: "Failed to update deliverable", variant: "destructive" });
    },
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/deliverables/${id}`, { isDeleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      toast({ title: "Deliverable moved to recycle bin" });
    },
    onError: () => {
      toast({ title: "Failed to delete deliverable", variant: "destructive" });
    },
  });

  const createActionWithStatus = useMutation({
    mutationFn: async ({ status, deliverableId }: { status: ActionStatusType; deliverableId?: string }) => {
      return apiRequest("POST", "/api/actions", { 
        name: "New Action", 
        solutionId, 
        streamId, 
        status,
        deliverableId,
      });
    },
    onSuccess: async (response) => {
      const newAction = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      setEditingAction(newAction);
      toast({ title: "Action created" });
    },
    onError: () => {
      toast({ title: "Failed to create action", variant: "destructive" });
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
    setLocation(`/stream/${streamId}/solution/${solutionId}/action/${actionId}`);
  };

  const isLoading = solutionLoading || actionsLoading || deliverablesLoading;

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

  if (!solution) {
    return (
      <div className="p-6">
        <EmptyState
          icon={CheckSquare}
          title="Solution not found"
          description="The solution you're looking for doesn't exist or has been deleted."
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
            description="Create your first action to start tracking work in this solution."
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
              <h1 className="text-lg font-semibold" data-testid="text-solution-name">{solution.name}</h1>
              <Button
                size="sm"
                variant={solution.status === SolutionStatus.ON_HOLD ? "secondary" : "outline"}
                onClick={() => {
                  const newStatus = solution.status === SolutionStatus.ON_HOLD 
                    ? SolutionStatus.IN_PROGRESS 
                    : SolutionStatus.ON_HOLD;
                  updateSolutionStatus.mutate(newStatus);
                }}
                data-testid="button-toggle-solution-status"
              >
                {solution.status === SolutionStatus.ON_HOLD ? "On Hold" : "In Progress"}
              </Button>
              {isEditMode && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditingSolution(true)}
                  data-testid="button-edit-solution"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {solution.milestoneDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(solution.milestoneDate).toLocaleDateString()}</span>
                </div>
              )}
              {solution.owners && solution.owners.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{solution.owners.join(", ")}</span>
                </div>
              )}
              {solution.labels && solution.labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-4 h-4" />
                  {solution.labels.map((label) => (
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
              deliverables={deliverables?.filter((d) => !d.isDeleted) || []}
              onActionClick={handleActionClick}
              onActionEdit={(action) => setEditingAction(action)}
              onStatusChange={(actionId, status) => updateActionStatus.mutate({ actionId, status })}
              onDeliverableChange={(actionId, deliverableId) => updateActionDeliverable.mutate({ actionId, deliverableId })}
              onReorder={(actionId, kanbanOrder) => updateActionOrder.mutate({ actionId, kanbanOrder })}
              onDeliverableReorder={(deliverableId, ordinal) => updateDeliverableOrdinal.mutate({ deliverableId, ordinal })}
              onAddAction={(status, deliverableId) => createActionWithStatus.mutate({ status, deliverableId })}
              onAddDeliverable={(name, borderColor) => createDeliverable.mutate({ name, borderColor })}
              onEditDeliverable={(deliverable) => setEditingDeliverable(deliverable)}
              showDescription={showDescriptions}
            />

            {isEditMode && (
              <div className="max-w-sm">
                <QuickAddForm
                  ref={quickAddRef}
                  placeholder="Add new action..."
                  onAdd={(name) => createAction.mutate(name)}
                  isLoading={createAction.isPending}
                />
              </div>
            )}
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

      <EditSolutionDialog
        solution={solution}
        open={editingSolution}
        onOpenChange={setEditingSolution}
        onDeleted={() => setLocation(`/stream/${streamId}`)}
      />

      <EditActionDialog
        action={editingAction}
        open={editingAction !== null}
        onOpenChange={(open) => !open && setEditingAction(null)}
      />

      <EditDeliverablePopup
        deliverable={editingDeliverable}
        open={editingDeliverable !== null}
        onOpenChange={(open) => !open && setEditingDeliverable(null)}
        onSave={(id, data) => updateDeliverable.mutate({ id, data })}
        onDelete={(id) => deleteDeliverable.mutate(id)}
        isPending={updateDeliverable.isPending || deleteDeliverable.isPending}
      />
    </div>
  );
}
