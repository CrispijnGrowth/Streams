import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Calendar, User, Pencil, Trash2, MessageSquare, Send, Loader2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMode } from "@/lib/mode-context";
import type { Step, Comment } from "@shared/schema";

interface StepListProps {
  steps: Step[];
  onToggle?: (stepId: string, isDone: boolean) => void;
}

function StepComments({ stepId }: { stepId: string }) {
  const { toast } = useToast();
  const { isEditMode } = useMode();
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "step", stepId],
    enabled: !!stepId,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/comments", {
        entityType: "step",
        entityId: stepId,
        content,
      });
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "step", stepId] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const updateComment = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      return apiRequest("PATCH", `/api/comments/${id}`, { content });
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditingCommentContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "step", stepId] });
      toast({ title: "Comment updated" });
    },
    onError: () => {
      toast({ title: "Failed to update comment", variant: "destructive" });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/comments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "step", stepId] });
      toast({ title: "Comment deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    },
  });

  return (
    <div className="mt-2 pt-2 border-t space-y-2">
      {comments.length > 0 && (
        <div className="space-y-1.5">
          {comments.map((comment) => (
            <div key={comment.id} className="text-xs bg-muted/50 p-2 rounded">
              {editingCommentId === comment.id ? (
                <div className="flex gap-1.5">
                  <Input
                    value={editingCommentContent}
                    onChange={(e) => setEditingCommentContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingCommentContent.trim()) {
                        e.preventDefault();
                        updateComment.mutate({ id: comment.id, content: editingCommentContent.trim() });
                      }
                      if (e.key === "Escape") {
                        setEditingCommentId(null);
                        setEditingCommentContent("");
                      }
                    }}
                    className="flex-1 h-7 text-xs"
                    autoFocus
                    data-testid={`input-edit-step-comment-${comment.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={!editingCommentContent.trim() || updateComment.isPending}
                    onClick={() => updateComment.mutate({ id: comment.id, content: editingCommentContent.trim() })}
                    data-testid={`button-save-step-comment-${comment.id}`}
                  >
                    {updateComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingCommentContent("");
                    }}
                    data-testid={`button-cancel-step-comment-${comment.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-foreground">{comment.content}</p>
                    <span className="text-muted-foreground">
                      {format(new Date(comment.createdAt), "MMM d 'at' h:mm a")}
                    </span>
                  </div>
                  {isEditMode && (
                    <div className="flex gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditingCommentContent(comment.content);
                        }}
                        data-testid={`button-edit-step-comment-${comment.id}`}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-destructive"
                        onClick={() => deleteComment.mutate(comment.id)}
                        disabled={deleteComment.isPending}
                        data-testid={`button-delete-step-comment-${comment.id}`}
                      >
                        {deleteComment.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          placeholder="Add comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && newComment.trim()) {
              e.preventDefault();
              addComment.mutate(newComment.trim());
            }
          }}
          className="h-7 text-xs"
          data-testid={`input-step-comment-${stepId}`}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={!newComment.trim() || addComment.isPending}
          onClick={() => newComment.trim() && addComment.mutate(newComment.trim())}
          data-testid={`button-add-step-comment-${stepId}`}
        >
          {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

function StepItem({ step, onToggle }: { step: Step; onToggle?: (stepId: string, isDone: boolean) => void }) {
  const { toast } = useToast();
  const { isEditMode } = useMode();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(step.name);
  
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "step", step.id],
    enabled: !!step.id,
  });

  const updateStep = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("PATCH", `/api/steps/${step.id}`, { name });
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      toast({ title: "Step updated" });
    },
    onError: () => {
      toast({ title: "Failed to update step", variant: "destructive" });
    },
  });

  const deleteStep = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/steps/${step.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Step deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete step", variant: "destructive" });
    },
  });

  const isOverdue = step.dueDate && !step.isDone && new Date(step.dueDate) < new Date();
  const commentCount = comments.length;

  return (
    <div
      className={`p-3 rounded-lg border transition-colors group ${
        step.isDone ? "bg-muted/50" : "bg-card"
      }`}
      data-testid={`step-${step.id}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={step.isDone}
          onCheckedChange={(checked) => onToggle?.(step.id, checked as boolean)}
          className="mt-0.5"
          data-testid={`checkbox-step-${step.id}`}
        />
        <div className="flex-1 min-w-0 space-y-1">
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editName.trim()) {
                    e.preventDefault();
                    updateStep.mutate(editName.trim());
                  }
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditName(step.name);
                  }
                }}
                className="flex-1"
                autoFocus
                data-testid={`input-edit-step-${step.id}`}
              />
              <Button
                size="icon"
                variant="outline"
                disabled={!editName.trim() || updateStep.isPending}
                onClick={() => updateStep.mutate(editName.trim())}
                data-testid={`button-save-step-${step.id}`}
              >
                {updateStep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(step.name);
                }}
                data-testid={`button-cancel-step-${step.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className={`text-sm ${step.isDone ? "line-through text-muted-foreground" : ""}`}>
                {step.name}
              </div>
              {step.note && (
                <p className="text-xs text-muted-foreground">{step.note}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {step.dueDate && (
                  <div className={`flex items-center gap-1 ${isOverdue ? "text-status-blocked" : ""}`}>
                    <Calendar className="h-3 w-3" />
                    <span className="font-mono">
                      {format(new Date(step.dueDate), "MMM d")}
                    </span>
                  </div>
                )}
                {step.owner && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{step.owner}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 relative"
              onClick={() => setCommentsOpen(!commentsOpen)}
              data-testid={`button-toggle-comments-${step.id}`}
            >
              <MessageSquare className="h-3 w-3" />
              {commentCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                  {commentCount}
                </span>
              )}
            </Button>
            {isEditMode && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsEditing(true);
                    setEditName(step.name);
                  }}
                  data-testid={`button-edit-step-${step.id}`}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => deleteStep.mutate()}
                  disabled={deleteStep.isPending}
                  data-testid={`button-delete-step-${step.id}`}
                >
                  {deleteStep.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </Button>
              </>
            )}
            {step.isDone && (
              <Badge variant="outline" className="bg-status-done/10 text-status-done border-status-done/30 text-xs">
                Done
              </Badge>
            )}
          </div>
        )}
      </div>
      
      <Collapsible open={commentsOpen} onOpenChange={setCommentsOpen}>
        <CollapsibleContent>
          <StepComments stepId={step.id} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function StepList({ steps, onToggle }: StepListProps) {
  const sortedSteps = [...steps].sort((a, b) => a.ordinal - b.ordinal);

  if (steps.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No steps defined
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedSteps.map((step) => (
        <StepItem key={step.id} step={step} onToggle={onToggle} />
      ))}
    </div>
  );
}
