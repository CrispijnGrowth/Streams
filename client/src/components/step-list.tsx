import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, User, Pencil, MessageSquare, ChevronDown, ChevronRight, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Step, Comment } from "@shared/schema";

interface StepListProps {
  steps: Step[];
  onToggle?: (stepId: string, isDone: boolean) => void;
  onEdit?: (step: Step) => void;
}

function StepComments({ stepId }: { stepId: string }) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");

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

  return (
    <div className="mt-2 pt-2 border-t space-y-2">
      {comments.length > 0 && (
        <div className="space-y-1.5">
          {comments.map((comment) => (
            <div key={comment.id} className="text-xs bg-muted/50 p-2 rounded">
              <p className="text-foreground">{comment.content}</p>
              <span className="text-muted-foreground">
                {format(new Date(comment.createdAt), "MMM d 'at' h:mm a")}
              </span>
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

function StepItem({ step, onToggle, onEdit }: { step: Step; onToggle?: (stepId: string, isDone: boolean) => void; onEdit?: (step: Step) => void }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "step", step.id],
    enabled: !!step.id,
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
        </div>
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
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onEdit?.(step)}
            data-testid={`button-edit-step-${step.id}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          {step.isDone && (
            <Badge variant="outline" className="bg-status-done/10 text-status-done border-status-done/30 text-xs">
              Done
            </Badge>
          )}
        </div>
      </div>
      
      <Collapsible open={commentsOpen} onOpenChange={setCommentsOpen}>
        <CollapsibleContent>
          <StepComments stepId={step.id} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function StepList({ steps, onToggle, onEdit }: StepListProps) {
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
        <StepItem key={step.id} step={step} onToggle={onToggle} onEdit={onEdit} />
      ))}
    </div>
  );
}
