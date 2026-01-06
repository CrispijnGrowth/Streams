import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ComboboxMultiSelect } from "@/components/ui/combobox-multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOwnerSuggestions } from "@/hooks/use-suggestions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DeliverableBorderColor, type Deliverable, type DeliverableBorderColorType, type Comment } from "@shared/schema";
import { Loader2, Trash2, Calendar, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";

const borderColorMap: Record<DeliverableBorderColorType, string> = {
  cyan: "var(--deliverable-cyan)",
  magenta: "var(--deliverable-magenta)",
  yellow: "var(--deliverable-yellow)",
  lime: "var(--deliverable-lime)",
  orange: "var(--deliverable-orange)",
  pink: "var(--deliverable-pink)",
  blue: "var(--deliverable-blue)",
  green: "var(--deliverable-green)",
};

interface EditDeliverablePopupProps {
  deliverable: Deliverable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { name: string; borderColor: DeliverableBorderColorType; owners: string[]; isMilestoneLinked: boolean; dueDate?: string }) => void;
  onDelete?: (id: string) => void;
  isPending?: boolean;
  anchorElement?: HTMLElement | null;
  parentMilestoneDate?: string;
  parentSolutionName?: string;
}

export function EditDeliverablePopup({
  deliverable,
  open,
  onOpenChange,
  onSave,
  onDelete,
  isPending = false,
  parentMilestoneDate,
  parentSolutionName,
}: EditDeliverablePopupProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [borderColor, setBorderColor] = useState<DeliverableBorderColorType>("cyan");
  const [owners, setOwners] = useState<string[]>([]);
  const [isMilestoneLinked, setIsMilestoneLinked] = useState(true);
  const [dueDate, setDueDate] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const ownerSuggestions = useOwnerSuggestions();

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "deliverable", deliverable?.id],
    queryFn: async () => {
      const res = await fetch(`/api/comments/deliverable/${deliverable?.id}`, {
        headers: { "x-session-id": localStorage.getItem("streams-session-id") || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!deliverable?.id && open,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/comments", {
        entityType: "deliverable",
        entityId: deliverable?.id,
        content,
      });
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "deliverable", deliverable?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (deliverable && open) {
      setName(deliverable.name);
      setBorderColor(deliverable.borderColor || "cyan");
      setOwners(deliverable.owners || []);
      setIsMilestoneLinked(deliverable.isMilestoneLinked ?? true);
      setDueDate(deliverable.dueDate || "");
    }
    if (!open) {
      setNewComment("");
    }
  }, [deliverable, open]);

  const handleSave = () => {
    if (deliverable && name.trim()) {
      const effectiveDueDate = isMilestoneLinked ? parentMilestoneDate : dueDate;
      if (isMilestoneLinked && effectiveDueDate && !validateDueDate(effectiveDueDate)) {
        return;
      }
      onSave(deliverable.id, { 
        name: name.trim(), 
        borderColor, 
        owners,
        isMilestoneLinked,
        dueDate: effectiveDueDate || undefined,
      });
      onOpenChange(false);
    }
  };

  const validateDueDate = (date: string) => {
    if (parentMilestoneDate && date) {
      return new Date(date) <= new Date(parentMilestoneDate);
    }
    return true;
  };

  if (!deliverable) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span />
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-deliverable-name">Name</Label>
            <Input
              id="edit-deliverable-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-edit-deliverable-name"
            />
          </div>

          <div className="space-y-2">
            <Label>Owners</Label>
            <ComboboxMultiSelect
              value={owners}
              onChange={setOwners}
              options={ownerSuggestions}
              placeholder="Select or add owners..."
              emptyText="No owners found."
              data-testid="combobox-deliverable-owners"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="milestone-linked" className="text-sm leading-tight">
                Part of {parentSolutionName || "solution"} milestone
              </Label>
              <Switch
                id="milestone-linked"
                checked={isMilestoneLinked}
                onCheckedChange={setIsMilestoneLinked}
                data-testid="switch-milestone-linked"
              />
            </div>
            {isMilestoneLinked && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Milestone: {parentMilestoneDate ? format(new Date(parentMilestoneDate), "MMM d, yyyy") : "No milestone set"}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate ? dueDate.split("T")[0] : ""}
              onChange={(e) => setDueDate(e.target.value)}
              max={isMilestoneLinked && parentMilestoneDate ? parentMilestoneDate.split("T")[0] : undefined}
              data-testid="input-deliverable-due-date"
            />
            {isMilestoneLinked && dueDate && !validateDueDate(dueDate) && (
              <p className="text-xs text-destructive">Due date cannot exceed parent milestone date</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Border Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(DeliverableBorderColor).map(([key, value]) => (
                <button
                  key={value}
                  type="button"
                  className={`w-8 h-8 rounded-md border-2 transition-all ${
                    borderColor === value ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: `hsl(${borderColorMap[value]})` }}
                  onClick={() => setBorderColor(value)}
                  data-testid={`button-edit-color-${value}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Comments
            </Label>
            {comments.length > 0 && (
              <ScrollArea className="h-20 rounded-md border p-2">
                <div className="space-y-1.5">
                  {comments.map((comment) => (
                    <div key={comment.id} className="text-xs">
                      <p className="text-foreground">{comment.content}</p>
                      <span className="text-muted-foreground/60">
                        {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <div className="flex gap-2">
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
                className="text-sm"
                data-testid="input-deliverable-comment"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!newComment.trim() || addComment.isPending}
                onClick={() => newComment.trim() && addComment.mutate(newComment.trim())}
                data-testid="button-add-deliverable-comment"
              >
                {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete(deliverable.id);
                  onOpenChange(false);
                }}
                disabled={isPending}
                data-testid="button-delete-deliverable"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!name.trim() || isPending || (!isMilestoneLinked && !!dueDate && !validateDueDate(dueDate))}
                data-testid="button-save-deliverable"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
