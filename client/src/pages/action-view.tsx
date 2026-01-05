import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ListChecks, Plus, Calendar, User, Clock, Pencil, MessageSquare, Send, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepList } from "@/components/step-list";
import { QuickAddForm, QuickAddFormRef } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditActionDialog, EditActionFocusField } from "@/components/edit-action-dialog";
import { EditStepDialog } from "@/components/edit-step-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { format } from "date-fns";
import type { ActionWithLastComment, Step, ActionStatusType, Comment } from "@shared/schema";
import { ActionStatus } from "@shared/schema";

interface ActionViewProps {
  streamId: string;
  solutionId: string;
  actionId: string;
}

export function ActionView({ streamId, solutionId, actionId }: ActionViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingAction, setEditingAction] = useState(false);
  const [editFocusField, setEditFocusField] = useState<EditActionFocusField>(null);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [newComment, setNewComment] = useState("");
  const quickAddRef = useRef<QuickAddFormRef>(null);

  const { data: action, isLoading: actionLoading } = useQuery<ActionWithLastComment>({
    queryKey: ["/api/actions", actionId],
  });

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "action", actionId],
    enabled: !!actionId,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/comments", {
        entityType: "action",
        entityId: actionId,
        content,
      });
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "action", actionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const { data: steps, isLoading: stepsLoading } = useQuery<Step[]>({
    queryKey: ["/api/actions", actionId, "steps"],
  });

  const updateAction = useMutation({
    mutationFn: async (updates: Partial<ActionWithLastComment>) => {
      return apiRequest("PATCH", `/api/actions/${actionId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
    onError: () => {
      toast({ title: "Failed to update action", variant: "destructive" });
    },
  });

  const statusOrder: ActionStatusType[] = [
    ActionStatus.BACKLOG,
    ActionStatus.TO_EXECUTE,
    ActionStatus.EXECUTING,
    ActionStatus.BLOCKED,
    ActionStatus.DELEGATED,
    ActionStatus.DONE,
    ActionStatus.ARCHIVE,
  ];

  const openEditWithFocus = useCallback((focus: EditActionFocusField) => {
    if (action) {
      setEditFocusField(focus);
      setEditingAction(true);
    }
  }, [action]);

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
        openEditWithFocus(null);
      }, [openEditWithFocus]),
      description: "Edit current action",
    },
    {
      key: "Delete",
      handler: useCallback(() => {
        if (action && !action.isDeleted) {
          updateAction.mutate({ isDeleted: true });
          toast({ title: "Action moved to recycle bin" });
          setLocation(`/stream/${streamId}/solution/${solutionId}`);
        }
      }, [action, streamId, solutionId]),
      description: "Delete current action",
    },
    {
      key: "a",
      handler: useCallback(() => {
        if (action) {
          updateAction.mutate({ status: ActionStatus.ARCHIVE });
          toast({ title: "Action archived" });
        }
      }, [action]),
      description: "Archive current action",
    },
    {
      key: "s",
      handler: useCallback(() => {
        if (action) {
          const currentIndex = statusOrder.indexOf(action.status as ActionStatusType);
          const nextIndex = (currentIndex + 1) % statusOrder.length;
          const newStatus = statusOrder[nextIndex];
          updateAction.mutate({ status: newStatus });
          toast({ title: `Status changed to ${newStatus}` });
        }
      }, [action]),
      description: "Cycle action status",
    },
    {
      key: "o",
      handler: useCallback(() => {
        openEditWithFocus("owner");
      }, [openEditWithFocus]),
      description: "Edit action owners",
    },
    {
      key: "l",
      handler: useCallback(() => {
        openEditWithFocus("label");
      }, [openEditWithFocus]),
      description: "Edit action labels",
    },
  ]);

  const createStep = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/steps", { name, actionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId, "steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      toast({ title: "Step created" });
    },
    onError: () => {
      toast({ title: "Failed to create step", variant: "destructive" });
    },
  });

  const toggleStep = useMutation({
    mutationFn: async ({ stepId, isDone }: { stepId: string; isDone: boolean }) => {
      return apiRequest("PATCH", `/api/steps/${stepId}`, { isDone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId, "steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solutionId, "actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const isLoading = actionLoading || stepsLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </Card>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ListChecks}
          title="Action not found"
          description="The action you're looking for doesn't exist or has been deleted."
        />
      </div>
    );
  }

  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    action.status !== "Done" &&
    action.status !== "Archive";

  return (
    <div className="p-6 space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold" data-testid="text-action-title">
                {action.name}
              </h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditingAction(true)}
                data-testid="button-edit-action"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            {action.description && (
              <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
            )}
          </div>
          <StatusBadge status={action.status} />
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {action.dueDate && (
            <div className={`flex items-center gap-1 ${isOverdue ? "text-status-blocked" : ""}`}>
              <Calendar className="h-4 w-4" />
              <span className="font-mono">
                {format(new Date(action.dueDate), "MMM d, yyyy")}
              </span>
              {isOverdue && <span className="font-medium ml-1">Overdue</span>}
            </div>
          )}
          {action.effort && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{action.effort} hours</span>
            </div>
          )}
          {action.owners.length > 0 && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>{action.owners.join(", ")}</span>
            </div>
          )}
        </div>

        {action.labels.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {action.labels.map((label) => (
              <Badge key={label} variant="outline" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono">
              {action.doneStepCount}/{action.stepCount} steps
            </span>
          </div>
          <ProgressBar value={action.progress} />
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Steps</h2>
          <span className="text-sm text-muted-foreground">
            {steps?.filter((s) => s.isDone).length || 0}/{steps?.length || 0} complete
          </span>
        </div>

        {!steps || steps.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={ListChecks}
              title="No steps yet"
              description="Break down this action into smaller steps to track progress."
            />
          </Card>
        ) : (
          <StepList
            steps={steps.filter((s) => !s.isDeleted)}
            onToggle={(stepId, isDone) => toggleStep.mutate({ stepId, isDone })}
            onEdit={(step) => setEditingStep(step)}
          />
        )}

        <QuickAddForm
          ref={quickAddRef}
          placeholder="Add new step..."
          onAdd={(name) => createStep.mutate(name)}
          isLoading={createStep.isPending}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments
        </h2>

        <Card className="p-4 space-y-4">
          {comments.length > 0 ? (
            <ScrollArea className="max-h-64">
              <div className="space-y-3 pr-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="text-sm border-b pb-3 last:border-0">
                    <p className="text-foreground">{comment.content}</p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && newComment.trim()) {
                  e.preventDefault();
                  addComment.mutate(newComment.trim());
                }
              }}
              data-testid="input-action-view-comment"
            />
            <Button
              size="icon"
              variant="outline"
              disabled={!newComment.trim() || addComment.isPending}
              onClick={() => newComment.trim() && addComment.mutate(newComment.trim())}
              data-testid="button-add-action-view-comment"
            >
              {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>

      <EditActionDialog
        action={action}
        open={editingAction}
        onOpenChange={(open) => {
          setEditingAction(open);
          if (!open) setEditFocusField(null);
        }}
        onDeleted={() => setLocation(`/stream/${streamId}/solution/${solutionId}`)}
        initialFocus={editFocusField}
      />

      <EditStepDialog
        step={editingStep}
        open={editingStep !== null}
        onOpenChange={(open) => !open && setEditingStep(null)}
      />
    </div>
  );
}
