import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ListChecks, Plus, Calendar, User, Clock, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepList } from "@/components/step-list";
import { QuickAddForm } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { EditActionDialog } from "@/components/edit-action-dialog";
import { EditStepDialog } from "@/components/edit-step-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { ActionWithProgress, Step } from "@shared/schema";

interface ActionViewProps {
  streamId: string;
  deliverableId: string;
  actionId: string;
}

export function ActionView({ streamId, deliverableId, actionId }: ActionViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingAction, setEditingAction] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);

  const { data: action, isLoading: actionLoading } = useQuery<ActionWithProgress>({
    queryKey: ["/api/actions", actionId],
  });

  const { data: steps, isLoading: stepsLoading } = useQuery<Step[]>({
    queryKey: ["/api/actions", actionId, "steps"],
  });

  const createStep = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/steps", { name, actionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId, "steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions", actionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverableId, "actions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverableId, "actions"] });
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
          placeholder="Add new step..."
          onAdd={(name) => createStep.mutate(name)}
          isLoading={createStep.isPending}
        />
      </div>

      <EditActionDialog
        action={action}
        open={editingAction}
        onOpenChange={setEditingAction}
        onDeleted={() => setLocation(`/stream/${streamId}/deliverable/${deliverableId}`)}
      />

      <EditStepDialog
        step={editingStep}
        open={editingStep !== null}
        onOpenChange={(open) => !open && setEditingStep(null)}
      />
    </div>
  );
}
