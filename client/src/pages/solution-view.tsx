import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckSquare, Tag, Calendar, Activity } from "lucide-react";
import { ClassNavigator } from "@/components/class-navigator";
import { Timeline } from "@/components/timeline";
import { KanbanBoard } from "@/components/kanban-board";
import { EmptyState } from "@/components/empty-state";
import { KanbanSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EditSolutionDialog } from "@/components/edit-solution-dialog";
import { EditActionDialog } from "@/components/edit-action-dialog";
import { EditDeliverablePopup } from "@/components/edit-deliverable-popup";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMode } from "@/lib/mode-context";
import { useTeamMembers } from "@/hooks/use-suggestions";
import type { SolutionWithProgress, ActionWithLastComment, Action, Deliverable, ActionStatusType, DeliverableBorderColorType, MomentumStatusType } from "@shared/schema";
import { SolutionStatus, ActionStatus } from "@shared/schema";

interface SolutionViewProps {
  streamId: string;
  solutionId: string;
  showDescriptions: boolean;
}

export function SolutionView({ streamId, solutionId, showDescriptions }: SolutionViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isEditMode, setAutoEditForEmptyState } = useMode();
  const teamMembers = useTeamMembers();
  const [editingSolution, setEditingSolution] = useState(false);

  const getOwnerInfo = (ownerName: string) => {
    return teamMembers.find((m) => m.name === ownerName);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [pendingActionStatus, setPendingActionStatus] = useState<ActionStatusType | null>(null);
  const [pendingDeliverableId, setPendingDeliverableId] = useState<string | undefined>(undefined);

  const { data: solution, isLoading: solutionLoading } = useQuery<SolutionWithProgress>({
    queryKey: ["/api/solutions", solutionId],
  });

  const { data: actions, isLoading: actionsLoading } = useQuery<ActionWithLastComment[]>({
    queryKey: ["/api/solutions", solutionId, "actions"],
  });

  const { data: deliverables, isLoading: deliverablesLoading } = useQuery<Deliverable[]>({
    queryKey: ["/api/solutions", solutionId, "deliverables"],
  });

  useEffect(() => {
    if (!actionsLoading && actions !== undefined) {
      const activeActions = actions.filter((a) => !a.isDeleted);
      setAutoEditForEmptyState(activeActions.length === 0);
    }
  }, [actions, actionsLoading, setAutoEditForEmptyState]);

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

  const updateMomentum = useMutation({
    mutationFn: async (momentumStatus: MomentumStatusType) => {
      return apiRequest("PATCH", `/api/solutions/${solutionId}`, { momentumStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
    onError: () => {
      toast({ title: "Failed to update momentum status", variant: "destructive" });
    },
  });

  const cycleMomentum = () => {
    if (!solution?.momentumStatus) return;
    const nextStatus: Record<MomentumStatusType, MomentumStatusType> = {
      Active: "Slowing",
      Slowing: "Stalled",
      Stalled: "Active",
    };
    updateMomentum.mutate(nextStatus[solution.momentumStatus as MomentumStatusType]);
  };

  const getMomentumColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "Slowing": return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "Stalled": return "bg-red-500/10 text-red-700 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

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
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description?: string; borderColor: DeliverableBorderColorType; owners: string[]; isMilestoneLinked: boolean; dueDate?: string } }) => {
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

  const deliverableTimelineItems = deliverables?.map((d) => ({
    id: d.id,
    title: d.name,
    description: d.description,
    date: d.dueDate,
    type: "deliverable" as const,
    borderColor: d.borderColor,
    parentName: solution?.name,
  })) || [];

  const actionTimelineItems = actions
    ?.filter((a) => a.status !== ActionStatus.DONE && a.status !== ActionStatus.ARCHIVE)
    .map((a) => {
      const parentDeliverable = deliverables?.find(d => d.id === a.deliverableId);
      return {
        id: a.id,
        title: a.name,
        description: a.description,
        date: a.dueDate,
        status: a.status,
        progress: a.progress,
        type: "action" as const,
        parentId: a.deliverableId,
        borderColor: parentDeliverable?.borderColor,
        parentName: parentDeliverable?.name,
      };
    }) || [];

  const timelineItems = [...deliverableTimelineItems, ...actionTimelineItems];

  const handleActionClick = (actionId: string) => {
    setLocation(`/stream/${streamId}/solution/${solutionId}/action/${actionId}`);
  };

  const handleTimelineItemClick = (itemId: string) => {
    const isDeliverable = deliverables?.some(d => d.id === itemId);
    if (isDeliverable) {
      const deliverable = deliverables?.find(d => d.id === itemId);
      if (deliverable) {
        setEditingDeliverable(deliverable);
      }
    } else {
      handleActionClick(itemId);
    }
  };

  const updateDeliverableDate = useMutation({
    mutationFn: async ({ deliverableId, dueDate }: { deliverableId: string; dueDate: string }) => {
      return apiRequest("PATCH", `/api/deliverables/${deliverableId}`, { dueDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "deliverables"] });
    },
  });

  const handleTimelineDateChange = (itemId: string, newDate: string) => {
    const isDeliverable = deliverables?.some(d => d.id === itemId);
    if (isDeliverable) {
      updateDeliverableDate.mutate({ deliverableId: itemId, dueDate: newDate });
    } else {
      updateActionDate.mutate({ actionId: itemId, dueDate: newDate });
    }
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


  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6 relative z-0">
        <div className="space-y-6">
          <div 
            className={`space-y-3 pb-4 border-b pt-2 ${isEditMode ? "border-2 border-dashed border-primary rounded-md p-4 cursor-pointer hover-elevate" : ""}`}
            onClick={isEditMode ? () => setEditingSolution(true) : undefined}
          >
            <ClassNavigator currentLevel="solution" streamId={streamId} solutionId={solutionId} />
            
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg font-semibold" data-testid="text-solution-name">{solution.name}</h1>
                {solution.momentumStatus && (
                  <Badge 
                    variant="secondary" 
                    className={`${getMomentumColor(solution.momentumStatus)} cursor-pointer`}
                    onClick={(e) => { e.stopPropagation(); cycleMomentum(); }}
                    data-testid="badge-solution-momentum-status"
                  >
                    <Activity className="w-3 h-3 mr-1" />
                    {solution.momentumStatus}
                  </Badge>
                )}
                {solution.lastMovementAt && (
                  <span className="text-sm text-muted-foreground">
                    Last change: {new Date(solution.lastMovementAt).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                {solution.priority && (
                  <div 
                    className={`flex items-center justify-center rounded-full border-2 font-bold ${
                      solution.priority === 1 ? "w-10 h-10 text-lg border-foreground bg-foreground/10" :
                      solution.priority === 2 ? "w-9 h-9 text-base border-foreground/80 bg-foreground/8" :
                      solution.priority === 3 ? "w-8 h-8 text-sm border-foreground/60 bg-foreground/6" :
                      solution.priority === 4 ? "w-7 h-7 text-xs border-foreground/40 bg-foreground/4" :
                      "w-6 h-6 text-xs border-foreground/30 bg-foreground/3"
                    }`}
                    data-testid="badge-solution-priority"
                    title={`Priority ${solution.priority}`}
                  >
                    {solution.priority}
                  </div>
                )}
                {solution.milestoneDate && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-primary">{new Date(solution.milestoneDate).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
                <Button
                  size="sm"
                  variant={solution.status === SolutionStatus.ON_HOLD ? "secondary" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newStatus = solution.status === SolutionStatus.ON_HOLD 
                      ? SolutionStatus.IN_PROGRESS 
                      : SolutionStatus.ON_HOLD;
                    updateSolutionStatus.mutate(newStatus);
                  }}
                  data-testid="button-toggle-solution-status"
                >
                  {solution.status === SolutionStatus.ON_HOLD ? "On Hold" : "In Progress"}
                </Button>
                {solution.owners && solution.owners.length > 0 && (
                  <div className="flex items-center -space-x-2">
                    {solution.owners.slice(0, 5).map((owner) => {
                      const info = getOwnerInfo(owner);
                      return (
                        <Tooltip key={owner}>
                          <TooltipTrigger asChild>
                            <Avatar className="h-10 w-10 border-2 border-background">
                              {(info?.photoData || info?.photoUrl) ? (
                                <AvatarImage src={info.photoData || info.photoUrl || ""} alt={owner} />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(owner)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{owner}</p>
                            {info?.role && <p className="text-xs text-muted-foreground">{info.role}</p>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {solution.owners.length > 5 && (
                      <Avatar className="h-10 w-10 border-2 border-background">
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          +{solution.owners.length - 5}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showDescriptions && solution.description && (
              <p className="text-sm text-muted-foreground max-w-3xl" data-testid="text-solution-description">
                {solution.description}
              </p>
            )}

            {solution.labels && solution.labels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-4 h-4 text-muted-foreground" />
                {solution.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">

            <KanbanBoard
              actions={(actions || []).filter((a) => !a.isDeleted)}
              deliverables={deliverables?.filter((d) => !d.isDeleted) || []}
              parentMilestoneDate={solution.milestoneDate}
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

          </div>
        </div>
      </div>

      <div className="shrink-0 border-t p-4 bg-background relative z-50">
        <Timeline
          items={timelineItems}
          onItemClick={handleTimelineItemClick}
          onDateChange={handleTimelineDateChange}
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
        parentMilestoneDate={solution.milestoneDate}
        parentSolutionName={solution.name}
      />
    </div>
  );
}
