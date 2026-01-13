import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Package, Tag, Calendar, Activity } from "lucide-react";
import { useHeroTransition } from "@/lib/hero-transition-context";
import { ClassNavigator } from "@/components/class-navigator";
import { Timeline } from "@/components/timeline";
import { SolutionCard } from "@/components/solution-card";
import { QuickAddForm, QuickAddFormRef } from "@/components/quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { SolutionCardSkeleton, TimelineSkeleton } from "@/components/loading-skeleton";
import { EditStreamDialog, EditStreamFocusField } from "@/components/edit-stream-dialog";
import { EditSolutionDialog } from "@/components/edit-solution-dialog";
import { CardStakeholderTags } from "@/components/card-stakeholder-tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMode } from "@/lib/mode-context";
import { useTeamMembers, getLabelColor } from "@/hooks/use-suggestions";
import type { Stream, SolutionWithBreakdownAndComment, Solution, MomentumStatusType, SolutionStatusType } from "@shared/schema";
import { SolutionStatus } from "@shared/schema";

interface StreamViewProps {
  streamId: string;
  showDescriptions: boolean;
}

export function StreamView({ streamId, showDescriptions }: StreamViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isEditMode, setAutoEditForEmptyState } = useMode();
  const { registerTarget, transitionComplete } = useHeroTransition();
  const teamMembers = useTeamMembers();
  const [editingStream, setEditingStream] = useState(false);
  const [editFocusField, setEditFocusField] = useState<EditStreamFocusField>(null);
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null);
  const quickAddRef = useRef<QuickAddFormRef>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const getOwnerInfo = (ownerName: string) => {
    return teamMembers.find((m) => m.name === ownerName);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const { data: stream, isLoading: streamLoading } = useQuery<Stream>({
    queryKey: ["/api/streams", streamId],
  });

  const { data: solutions, isLoading: solutionsLoading } = useQuery<SolutionWithBreakdownAndComment[]>({
    queryKey: ["/api/streams", streamId, "solutions"],
  });

  useEffect(() => {
    if (titleRef.current && stream) {
      registerTarget(streamId, titleRef.current);
    }
    return () => registerTarget(streamId, null);
  }, [streamId, registerTarget, stream]);

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

  const updateStreamStatus = useMutation({
    mutationFn: async (status: SolutionStatusType) => {
      return apiRequest("PATCH", `/api/streams/${streamId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams", streamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });
  
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
    momentumStatus: s.momentumStatus,
    counts: {
      doing: s.doingCount,
      blocked: s.blockedCount,
      delegated: s.delegatedCount,
    },
    type: "solution" as const,
    parentName: stream?.name,
    isOnHold: s.status === SolutionStatus.ON_HOLD,
  })) || [];

  const handleSolutionClick = (solutionId: string) => {
    setLocation(`/stream/${streamId}/solution/${solutionId}`);
  };

  const isLoading = streamLoading || solutionsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto px-6 pt-3 pb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SolutionCardSkeleton key={i} />
            ))}
          </div>
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
        <div className="flex-1 overflow-auto px-6 pt-3 pb-6 space-y-4">
          <EmptyState
            icon={Package}
            title="No solutions yet"
            description="Create your first solution to start tracking progress in this stream."
            actionLabel="Create Solution"
            onAction={() => createSolution.mutate("New Solution")}
          />
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
      <div className="flex-1 overflow-auto px-6 pt-3 pb-6">
        <div className="space-y-4">
          <motion.div 
            className={`space-y-2 pb-3 border-b ${isEditMode ? "border-2 border-dashed border-primary rounded-md p-4 cursor-pointer hover-elevate" : ""}`}
            onClick={isEditMode ? () => setEditingStream(true) : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: transitionComplete ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <ClassNavigator currentLevel="stream" streamId={streamId} />
            
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <motion.h1 
                  ref={titleRef} 
                  className="text-xl font-semibold" 
                  data-testid="text-stream-name"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: transitionComplete ? 0 : 0.75 }}
                >
                  {stream.name}
                </motion.h1>
                {stream.momentumStatus && (
                  <Badge 
                    variant="secondary" 
                    className={`${getMomentumColor(stream.momentumStatus)} cursor-pointer`}
                    onClick={(e) => { e.stopPropagation(); cycleMomentum(); }}
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
                <CardStakeholderTags entityType="stream" entityId={streamId} />
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                {stream.computedMilestoneDate && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-primary">{new Date(stream.computedMilestoneDate).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-[#0058AB] text-white border-[#0058AB]"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newStatus = (stream.status || "In Progress") === SolutionStatus.ON_HOLD 
                      ? SolutionStatus.IN_PROGRESS 
                      : SolutionStatus.ON_HOLD;
                    updateStreamStatus.mutate(newStatus);
                  }}
                  data-testid="button-toggle-stream-status"
                >
                  {(stream.status || "In Progress") === SolutionStatus.ON_HOLD ? "On Hold" : "In Progress"}
                </Button>
                {stream.owners && stream.owners.length > 0 && (
                  <div className="flex items-center -space-x-2">
                    {stream.owners.slice(0, 5).map((owner) => {
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
                    {stream.owners.length > 5 && (
                      <Avatar className="h-10 w-10 border-2 border-background">
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          +{stream.owners.length - 5}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showDescriptions && stream.description && (
              <p className="text-sm text-muted-foreground max-w-3xl" data-testid="text-stream-description">
                {stream.description}
              </p>
            )}

            {stream.labels && stream.labels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-4 h-4 text-muted-foreground" />
                {stream.labels.map((label) => (
                  <Badge key={label} variant="outline" className={`text-xs ${getLabelColor(label)}`}>
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: transitionComplete ? 0 : 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
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
                .map((solution, index) => (
                  <motion.div
                    key={solution.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: transitionComplete ? 0 : 0.5 + index * 0.08,
                      ease: [0.32, 0.72, 0, 1]
                    }}
                  >
                    <SolutionCard
                      solution={solution}
                      onClick={() => handleSolutionClick(solution.id)}
                      onEdit={isEditMode ? () => setEditingSolution(solution) : undefined}
                      showDescription={showDescriptions}
                    />
                  </motion.div>
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
          </motion.div>

          <Timeline
            items={timelineItems}
            onItemClick={handleSolutionClick}
            onDateChange={(id, newDate) => updateSolutionDate.mutate({ solutionId: id, milestoneDate: newDate })}
            level="solution"
            defaultWindowMonths={12}
          />
        </div>
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
