import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Users, Tag, Calendar, Activity, Pencil } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { SolutionCard } from "@/components/solution-card";
import { QuickAddForm, QuickAddFormRef } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { SolutionCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { EditStreamDialog, EditStreamFocusField } from "@/components/edit-stream-dialog";
import { EditSolutionDialog } from "@/components/edit-solution-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMode } from "@/lib/mode-context";
import type { Stream, SolutionWithBreakdownAndComment, Solution, MomentumStatusType } from "@shared/schema";
import { SolutionStatus } from "@shared/schema";

interface StreamViewProps {
  streamId: string;
  showDescriptions: boolean;
}

export function StreamView({ streamId, showDescriptions }: StreamViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isEditMode, setAutoEditForEmptyState } = useMode();
  const [editingStream, setEditingStream] = useState(false);
  const [editFocusField, setEditFocusField] = useState<EditStreamFocusField>(null);
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null);
  const quickAddRef = useRef<QuickAddFormRef>(null);

  const { data: stream, isLoading: streamLoading } = useQuery<Stream>({
    queryKey: ["/api/streams", streamId],
  });

  const { data: solutions, isLoading: solutionsLoading } = useQuery<SolutionWithBreakdownAndComment[]>({
    queryKey: ["/api/streams", streamId, "solutions"],
  });

  useEffect(() => {
    if (!solutionsLoading && solutions !== undefined) {
      const activeSolutions = solutions.filter((s) => !s.isDeleted);
      setAutoEditForEmptyState(activeSolutions.length === 0);
    }
  }, [solutions, solutionsLoading, setAutoEditForEmptyState]);

  const deleteStream = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/streams/${streamId}`, { isDeleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Stream moved to recycle bin" });
      setLocation("/");
    },
    onError: () => {
      toast({ title: "Failed to delete stream", variant: "destructive" });
    },
  });

  const updateMomentum = useMutation({
    mutationFn: async (momentumStatus: MomentumStatusType) => {
      return apiRequest("PATCH", `/api/streams/${streamId}`, { momentumStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams", streamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const cycleMomentum = () => {
    if (!stream?.momentumStatus) return;
    const nextStatus: Record<MomentumStatusType, MomentumStatusType> = {
      Active: "Slowing",
      Slowing: "Stalled",
      Stalled: "Active",
    };
    updateMomentum.mutate(nextStatus[stream.momentumStatus as MomentumStatusType]);
  };

  
  const openEditWithFocus = useCallback((focus: EditStreamFocusField) => {
    if (stream) {
      setEditFocusField(focus);
      setEditingStream(true);
    }
  }, [stream]);

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
      description: "Edit stream",
    },
    {
      key: "Delete",
      handler: useCallback(() => {
        if (stream && !stream.isDeleted) {
          deleteStream.mutate();
        }
      }, [stream]),
      description: "Delete current stream",
    },
    {
      key: "o",
      handler: useCallback(() => {
        openEditWithFocus("owner");
      }, [openEditWithFocus]),
      description: "Edit stream owners",
    },
    {
      key: "l",
      handler: useCallback(() => {
        openEditWithFocus("label");
      }, [openEditWithFocus]),
      description: "Edit stream labels",
    },
  ]);

  const createSolution = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/solutions", { name, streamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams", streamId, "solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Solution created" });
    },
    onError: () => {
      toast({ title: "Failed to create solution", variant: "destructive" });
    },
  });

  const updateSolutionDate = useMutation({
    mutationFn: async ({ solutionId, milestoneDate }: { solutionId: string; milestoneDate: string }) => {
      return apiRequest("PATCH", `/api/solutions/${solutionId}`, { milestoneDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams", streamId, "solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const timelineItems = solutions?.map((s) => ({
    id: s.id,
    title: s.name,
    description: s.description,
    date: s.milestoneDate,
    progress: s.progress,
    counts: {
      doing: s.doingCount,
      blocked: s.blockedCount,
      delegated: s.delegatedCount,
    },
    type: "solution" as const,
    parentName: stream?.name,
  })) || [];

  const handleSolutionClick = (solutionId: string) => {
    setLocation(`/stream/${streamId}/solution/${solutionId}`);
  };

  const isLoading = streamLoading || solutionsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SolutionCardSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t p-4 bg-background">
          <TimelineSkeleton />
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Stream not found"
          description="The stream you're looking for doesn't exist or has been deleted."
        />
      </div>
    );
  }

  if (!solutions || solutions.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto p-6">
          <EmptyState
            icon={Package}
            title="No solutions yet"
            description="Create your first solution to start tracking progress in this stream."
            actionLabel="Create Solution"
            onAction={() => createSolution.mutate("New Solution")}
          />
        </div>
        <div className="shrink-0 border-t p-4 bg-background">
          <Timeline
            items={[]}
            onItemClick={handleSolutionClick}
            level="solution"
          />
        </div>
      </div>
    );
  }

  const getMomentumColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "Slowing": return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "Stalled": return "bg-red-500/10 text-red-700 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="space-y-3 pb-4 border-b pt-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">Stream</span>
                  <h1 className="text-xl font-semibold" data-testid="text-stream-name">{stream.name}</h1>
                </div>
                {isEditMode && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingStream(true)}
                    data-testid="button-edit-stream"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {stream.momentumStatus && (
                  <Badge 
                    variant="secondary" 
                    className={`${getMomentumColor(stream.momentumStatus)} cursor-pointer`}
                    onClick={cycleMomentum}
                    data-testid="badge-momentum-status"
                  >
                    <Activity className="w-3 h-3 mr-1" />
                    {stream.momentumStatus}
                  </Badge>
                )}
                {stream.lastMovementAt && (
                  <span className="text-sm text-muted-foreground">
                    Last change: {new Date(stream.lastMovementAt).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>
            </div>

            {showDescriptions && stream.description && (
              <p className="text-sm text-muted-foreground max-w-3xl" data-testid="text-stream-description">
                {stream.description}
              </p>
            )}

            <div className="flex items-center gap-4 flex-wrap text-sm">
              {stream.owners && stream.owners.length > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{stream.owners.join(", ")}</span>
                </div>
              )}
              {stream.labels && stream.labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {stream.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
              {stream.computedMilestoneDate && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Milestone: {new Date(stream.computedMilestoneDate).toLocaleDateString('en-GB')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Solutions</h2>
              <span className="text-sm text-muted-foreground">
                {solutions.length} solution{solutions.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {solutions
                .filter((s) => !s.isDeleted)
                .sort((a, b) => {
                  const aOnHold = a.status === SolutionStatus.ON_HOLD ? 1 : 0;
                  const bOnHold = b.status === SolutionStatus.ON_HOLD ? 1 : 0;
                  if (aOnHold !== bOnHold) return aOnHold - bOnHold;
                  return a.ordinal - b.ordinal;
                })
                .map((solution) => (
                  <SolutionCard
                    key={solution.id}
                    solution={solution}
                    onClick={() => handleSolutionClick(solution.id)}
                    onEdit={isEditMode ? () => setEditingSolution(solution) : undefined}
                    showDescription={showDescriptions}
                  />
                ))}
            </div>

            {isEditMode && (
              <div className="max-w-sm">
                <QuickAddForm
                  ref={quickAddRef}
                  placeholder="Add new solution..."
                  onAdd={(name) => createSolution.mutate(name)}
                  isLoading={createSolution.isPending}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t p-4 bg-background">
        <Timeline
          items={timelineItems}
          onItemClick={handleSolutionClick}
          onDateChange={(id, newDate) => updateSolutionDate.mutate({ solutionId: id, milestoneDate: newDate })}
          level="solution"
          defaultWindowMonths={12}
        />
      </div>

      <EditStreamDialog
        stream={stream}
        open={editingStream}
        onOpenChange={(open) => {
          setEditingStream(open);
          if (!open) setEditFocusField(null);
        }}
        onDeleted={() => setLocation("/")}
        initialFocus={editFocusField}
      />

      <EditSolutionDialog
        solution={editingSolution}
        open={editingSolution !== null}
        onOpenChange={(open) => !open && setEditingSolution(null)}
      />
    </div>
  );
}
