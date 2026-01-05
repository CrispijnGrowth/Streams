import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxMultiSelect } from "@/components/ui/combobox-multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOwnerSuggestions, useLabelSuggestions } from "@/hooks/use-suggestions";
import type { Solution, Comment } from "@shared/schema";
import { SolutionStatus } from "@shared/schema";
import { format } from "date-fns";

const editSolutionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  milestoneDate: z.string().optional(),
  status: z.string(),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

type EditSolutionForm = z.infer<typeof editSolutionSchema>;

interface EditSolutionDialogProps {
  solution: Solution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function EditSolutionDialog({ solution, open, onOpenChange, onDeleted }: EditSolutionDialogProps) {
  const { toast } = useToast();
  const ownerSuggestions = useOwnerSuggestions();
  const labelSuggestions = useLabelSuggestions();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "solution", solution?.id],
    queryFn: async () => {
      const res = await fetch(`/api/comments/solution/${solution?.id}`, {
        headers: { "x-session-id": localStorage.getItem("streams-session-id") || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!solution?.id && open,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/comments", {
        entityType: "solution",
        entityId: solution?.id,
        content,
      });
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "solution", solution?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const form = useForm<EditSolutionForm>({
    resolver: zodResolver(editSolutionSchema),
    defaultValues: {
      name: "",
      description: "",
      milestoneDate: "",
      status: SolutionStatus.IN_PROGRESS,
      owners: [],
      labels: [],
    },
  });

  useEffect(() => {
    if (solution && open) {
      form.reset({
        name: solution.name,
        description: solution.description || "",
        milestoneDate: solution.milestoneDate || "",
        status: solution.status,
        owners: solution.owners || [],
        labels: solution.labels || [],
      });
    }
    if (!open) {
      setNewComment("");
    }
  }, [solution, open, form]);

  const updateSolution = useMutation({
    mutationFn: async (data: EditSolutionForm) => {
      return apiRequest("PATCH", `/api/solutions/${solution?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", solution?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Solution updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update solution", variant: "destructive" });
    },
  });

  const deleteSolution = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/solutions/${solution?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Solution deleted" });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: () => {
      toast({ title: "Failed to delete solution", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditSolutionForm) => {
    updateSolution.mutate(data);
  };

  const owners = form.watch("owners");
  const labels = form.watch("labels");

  if (!solution) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Solution</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              data-testid="input-solution-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              rows={3}
              data-testid="input-solution-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="milestoneDate">Milestone Date</Label>
              <Input
                id="milestoneDate"
                type="date"
                {...form.register("milestoneDate")}
                data-testid="input-solution-milestone-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value)}
              >
                <SelectTrigger data-testid="select-solution-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SolutionStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Owners</Label>
            <ComboboxMultiSelect
              value={owners}
              onChange={(value) => form.setValue("owners", value)}
              options={ownerSuggestions}
              placeholder="Select or add owners..."
              emptyText="No owners found."
              data-testid="combobox-solution-owners"
            />
          </div>

          <div className="space-y-2">
            <Label>Labels</Label>
            <ComboboxMultiSelect
              value={labels}
              onChange={(value) => form.setValue("labels", value)}
              options={labelSuggestions}
              placeholder="Select or add labels..."
              emptyText="No labels found."
              data-testid="combobox-solution-labels"
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Comments
            </Label>
            {comments.length > 0 && (
              <ScrollArea className="h-32 rounded-md border p-2">
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="text-sm">
                      <p className="text-foreground">{comment.content}</p>
                      <span className="text-xs text-muted-foreground">
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
                data-testid="input-solution-comment"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!newComment.trim() || addComment.isPending}
                onClick={() => newComment.trim() && addComment.mutate(newComment.trim())}
                data-testid="button-add-solution-comment"
              >
                {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteSolution.mutate()}
              disabled={deleteSolution.isPending}
              data-testid="button-delete-solution"
            >
              {deleteSolution.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateSolution.isPending} data-testid="button-save-solution">
                {updateSolution.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
