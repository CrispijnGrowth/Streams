import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, RotateCcw, Layers, Target, CheckSquare, ListChecks, AlertTriangle, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Stream, Solution, Deliverable, Action, Step } from "@shared/schema";

interface DeletedItems {
  streams: Stream[];
  solutions: Solution[];
  deliverables: Deliverable[];
  actions: Action[];
  steps: Step[];
}

export function RecycleBin() {
  const { toast } = useToast();
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const { data: deletedItems, isLoading } = useQuery<DeletedItems>({
    queryKey: ["/api/recycle-bin"],
  });

  const emptyRecycleBin = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/recycle-bin/empty");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recycle-bin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/steps"] });
      toast({ title: "Recycle bin emptied", description: "All items have been permanently deleted." });
      setShowEmptyConfirm(false);
    },
    onError: () => {
      toast({ title: "Failed to empty recycle bin", variant: "destructive" });
    },
  });

  const restoreStream = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/recycle-bin/restore/stream/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recycle-bin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Stream restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore stream", variant: "destructive" });
    },
  });

  const restoreDeliverable = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/recycle-bin/restore/deliverable/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recycle-bin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Deliverable restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore deliverable", variant: "destructive" });
    },
  });

  const restoreSolution = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/recycle-bin/restore/solution/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recycle-bin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Solution restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore solution", variant: "destructive" });
    },
  });

  const restoreAction = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/recycle-bin/restore/action/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recycle-bin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Action restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore action", variant: "destructive" });
    },
  });

  const restoreStep = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/recycle-bin/restore/step/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recycle-bin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Step restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore step", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Recycle Bin</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasDeletedItems =
    deletedItems &&
    (deletedItems.streams.length > 0 ||
      deletedItems.solutions.length > 0 ||
      deletedItems.deliverables.length > 0 ||
      deletedItems.actions.length > 0 ||
      deletedItems.steps.length > 0);

  const totalItems = deletedItems
    ? deletedItems.streams.length +
      deletedItems.solutions.length +
      deletedItems.deliverables.length +
      deletedItems.actions.length +
      deletedItems.steps.length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Trash2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-recycle-bin-title">Recycle Bin</h1>
        </div>
        {hasDeletedItems && (
          <Button
            variant="destructive"
            onClick={() => setShowEmptyConfirm(true)}
            disabled={emptyRecycleBin.isPending}
            data-testid="button-empty-recycle-bin"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Empty Recycle Bin
          </Button>
        )}
      </div>

      <AlertDialog open={showEmptyConfirm} onOpenChange={setShowEmptyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Permanently Delete All Items?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {totalItems} item{totalItems !== 1 ? "s" : ""} from the recycle bin. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-empty">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => emptyRecycleBin.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-empty"
            >
              {emptyRecycleBin.isPending ? "Deleting..." : "Yes, Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!hasDeletedItems ? (
        <Card className="p-8">
          <EmptyState
            icon={Trash2}
            title="Recycle bin is empty"
            description="Deleted items will appear here and can be restored."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {deletedItems.streams.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Streams ({deletedItems.streams.length})
              </h2>
              <div className="space-y-2">
                {deletedItems.streams.map((stream) => (
                  <Card key={stream.id} className="p-4 flex items-center justify-between gap-4" data-testid={`deleted-stream-${stream.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{stream.key}</Badge>
                        <span className="font-medium truncate">{stream.name}</span>
                      </div>
                      {stream.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{stream.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreStream.mutate(stream.id)}
                      disabled={restoreStream.isPending}
                      data-testid={`button-restore-stream-${stream.id}`}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {deletedItems.solutions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Target className="h-5 w-5" />
                Solutions ({deletedItems.solutions.length})
              </h2>
              <div className="space-y-2">
                {deletedItems.solutions.map((solution) => (
                  <Card key={solution.id} className="p-4 flex items-center justify-between gap-4" data-testid={`deleted-solution-${solution.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{solution.key}</Badge>
                        <span className="font-medium truncate">{solution.name}</span>
                      </div>
                      {solution.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{solution.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreSolution.mutate(solution.id)}
                      disabled={restoreSolution.isPending}
                      data-testid={`button-restore-solution-${solution.id}`}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {deletedItems.deliverables.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Package className="h-5 w-5" />
                Deliverables ({deletedItems.deliverables.length})
              </h2>
              <div className="space-y-2">
                {deletedItems.deliverables.map((deliverable) => (
                  <Card key={deliverable.id} className="p-4 flex items-center justify-between gap-4" data-testid={`deleted-deliverable-${deliverable.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{deliverable.key}</Badge>
                        <span className="font-medium truncate">{deliverable.name}</span>
                      </div>
                      {deliverable.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{deliverable.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreDeliverable.mutate(deliverable.id)}
                      disabled={restoreDeliverable.isPending}
                      data-testid={`button-restore-deliverable-${deliverable.id}`}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {deletedItems.actions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Actions ({deletedItems.actions.length})
              </h2>
              <div className="space-y-2">
                {deletedItems.actions.map((action) => (
                  <Card key={action.id} className="p-4 flex items-center justify-between gap-4" data-testid={`deleted-action-${action.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{action.key}</Badge>
                        <span className="font-medium truncate">{action.name}</span>
                      </div>
                      {action.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{action.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreAction.mutate(action.id)}
                      disabled={restoreAction.isPending}
                      data-testid={`button-restore-action-${action.id}`}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {deletedItems.steps.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Steps ({deletedItems.steps.length})
              </h2>
              <div className="space-y-2">
                {deletedItems.steps.map((step) => (
                  <Card key={step.id} className="p-4 flex items-center justify-between gap-4" data-testid={`deleted-step-${step.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{step.key}</Badge>
                        <span className="font-medium truncate">{step.name}</span>
                      </div>
                      {step.note && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{step.note}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreStep.mutate(step.id)}
                      disabled={restoreStep.isPending}
                      data-testid={`button-restore-step-${step.id}`}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
