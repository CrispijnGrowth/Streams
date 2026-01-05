import { useState, useEffect } from "react";
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
import { Plus, Loader2, X, MessageSquare, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOwnerSuggestions, useLabelSuggestions } from "@/hooks/use-suggestions";
import type { Action, Deliverable, DeliverableBorderColorType, Comment } from "@shared/schema";
import { ActionStatus, DeliverableBorderColor } from "@shared/schema";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type EditActionFocusField = "owner" | "label" | null;

const editActionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  deliverableId: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string(),
  effort: z.union([z.number(), z.nan()]).optional().transform(val => (typeof val === 'number' && !isNaN(val)) ? val : undefined),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

type EditActionForm = z.infer<typeof editActionSchema>;

interface EditActionDialogProps {
  action: Action | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  initialFocus?: EditActionFocusField;
}

export function EditActionDialog({ action, open, onOpenChange, onDeleted, initialFocus }: EditActionDialogProps) {
  const { toast } = useToast();
  const [newDeliverableName, setNewDeliverableName] = useState("");
  const [newDeliverableDescription, setNewDeliverableDescription] = useState("");
  const [newDeliverableBorderColor, setNewDeliverableBorderColor] = useState<DeliverableBorderColorType>("cyan");
  const [newDeliverableDueDate, setNewDeliverableDueDate] = useState("");
  const [newDeliverableOwner, setNewDeliverableOwner] = useState("");
  const [isCreatingDeliverable, setIsCreatingDeliverable] = useState(false);
  const [isSubmittingWithNewDeliverable, setIsSubmittingWithNewDeliverable] = useState(false);
  const [newComment, setNewComment] = useState("");
  const ownerSuggestions = useOwnerSuggestions();
  const labelSuggestions = useLabelSuggestions();

  const { data: deliverables = [] } = useQuery<Deliverable[]>({
    queryKey: ["/api/solutions", action?.solutionId, "deliverables"],
    queryFn: async () => {
      const res = await fetch(`/api/solutions/${action?.solutionId}/deliverables`, {
        headers: { "x-session-id": localStorage.getItem("streams-session-id") || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch deliverables");
      return res.json();
    },
    enabled: !!action?.solutionId && open,
  });

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "action", action?.id],
    queryFn: async () => {
      const res = await fetch(`/api/comments/action/${action?.id}`, {
        headers: { "x-session-id": localStorage.getItem("streams-session-id") || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!action?.id && open,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/comments", {
        entityType: "action",
        entityId: action?.id,
        content,
      });
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "action", action?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const form = useForm<EditActionForm>({
    resolver: zodResolver(editActionSchema),
    defaultValues: {
      name: "",
      deliverableId: undefined,
      description: "",
      dueDate: "",
      status: ActionStatus.BACKLOG,
      effort: undefined,
      owners: [],
      labels: [],
    },
  });

  useEffect(() => {
    if (action && open) {
      form.reset({
        name: action.name,
        deliverableId: action.deliverableId || undefined,
        description: action.description || "",
        dueDate: action.dueDate || "",
        status: action.status,
        effort: action.effort,
        owners: action.owners || [],
        labels: action.labels || [],
      });
    }
    if (!open) {
      setNewDeliverableName("");
      setNewDeliverableDescription("");
      setNewDeliverableBorderColor("cyan");
      setNewDeliverableDueDate("");
      setNewDeliverableOwner("");
      setIsCreatingDeliverable(false);
      setIsSubmittingWithNewDeliverable(false);
      setNewComment("");
    }
  }, [action, open, form]);

  const updateAction = useMutation({
    mutationFn: async (data: EditActionForm) => {
      const payload = {
        ...data,
        deliverableId: data.deliverableId === "" ? null : data.deliverableId,
      };
      return apiRequest("PATCH", `/api/actions/${action?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions", action?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      toast({ title: "Action updated successfully" });
      setIsSubmittingWithNewDeliverable(false);
      setNewDeliverableName("");
      setNewDeliverableDescription("");
      setNewDeliverableBorderColor("cyan");
      setNewDeliverableDueDate("");
      setNewDeliverableOwner("");
      setIsCreatingDeliverable(false);
      onOpenChange(false);
    },
    onError: () => {
      setIsSubmittingWithNewDeliverable(false);
      toast({ title: "Failed to update action", variant: "destructive" });
    },
  });

  const deleteAction = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/actions/${action?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Action deleted" });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: () => {
      toast({ title: "Failed to delete action", variant: "destructive" });
    },
  });

  const resetNewDeliverableFields = () => {
    setNewDeliverableName("");
    setNewDeliverableDescription("");
    setNewDeliverableBorderColor("cyan");
    setNewDeliverableDueDate("");
    setNewDeliverableOwner("");
    setIsCreatingDeliverable(false);
  };

  const onSubmit = async (data: EditActionForm) => {
    if (isCreatingDeliverable && newDeliverableName.trim()) {
      setIsSubmittingWithNewDeliverable(true);
      try {
        const deliverablePayload: Record<string, unknown> = {
          name: newDeliverableName.trim(),
          solutionId: action?.solutionId,
          streamId: action?.streamId,
          borderColor: newDeliverableBorderColor,
        };
        if (newDeliverableDescription.trim()) {
          deliverablePayload.description = newDeliverableDescription.trim();
        }
        if (newDeliverableDueDate) {
          deliverablePayload.dueDate = newDeliverableDueDate;
        }
        if (newDeliverableOwner.trim()) {
          deliverablePayload.owners = [newDeliverableOwner.trim()];
        }
        const deliverableResponse = await apiRequest("POST", "/api/deliverables", deliverablePayload);
        const newDeliverable = await deliverableResponse.json();
        queryClient.invalidateQueries({ queryKey: ["/api/solutions", action?.solutionId, "deliverables"] });
        queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
        updateAction.mutate({ ...data, deliverableId: newDeliverable.id });
      } catch {
        setIsSubmittingWithNewDeliverable(false);
        toast({ title: "Failed to create deliverable", variant: "destructive" });
      }
    } else {
      updateAction.mutate(data);
    }
  };

  const owners = form.watch("owners");
  const labels = form.watch("labels");

  if (!action) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Action</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              data-testid="input-action-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable">Deliverable</Label>
            {isCreatingDeliverable ? (
              <Card className="border-2 border-dashed border-primary/50 bg-muted/30">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium">New Deliverable</CardTitle>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={resetNewDeliverableFields}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                  <div className="space-y-1">
                    <Label htmlFor="new-deliverable-name" className="text-xs">Name *</Label>
                    <Input
                      id="new-deliverable-name"
                      placeholder="Deliverable name..."
                      value={newDeliverableName}
                      onChange={(e) => setNewDeliverableName(e.target.value)}
                      autoFocus
                      data-testid="input-new-deliverable"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-deliverable-description" className="text-xs">Description</Label>
                    <Textarea
                      id="new-deliverable-description"
                      placeholder="Optional description..."
                      value={newDeliverableDescription}
                      onChange={(e) => setNewDeliverableDescription(e.target.value)}
                      rows={2}
                      data-testid="input-new-deliverable-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="new-deliverable-color" className="text-xs">Border Color</Label>
                      <Select
                        value={newDeliverableBorderColor}
                        onValueChange={(value) => setNewDeliverableBorderColor(value as DeliverableBorderColorType)}
                      >
                        <SelectTrigger data-testid="select-new-deliverable-color">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(DeliverableBorderColor).map((color) => (
                            <SelectItem key={color} value={color}>
                              <span className="flex items-center gap-2">
                                <span 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: color }}
                                />
                                {color.charAt(0).toUpperCase() + color.slice(1)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-deliverable-due-date" className="text-xs">Due Date</Label>
                      <Input
                        id="new-deliverable-due-date"
                        type="date"
                        value={newDeliverableDueDate}
                        onChange={(e) => setNewDeliverableDueDate(e.target.value)}
                        data-testid="input-new-deliverable-due-date"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-deliverable-owner" className="text-xs">Owner</Label>
                    <Input
                      id="new-deliverable-owner"
                      placeholder="Owner name..."
                      value={newDeliverableOwner}
                      onChange={(e) => setNewDeliverableOwner(e.target.value)}
                      list="owner-suggestions"
                      data-testid="input-new-deliverable-owner"
                    />
                    <datalist id="owner-suggestions">
                      {ownerSuggestions.map((owner) => (
                        <option key={owner} value={owner} />
                      ))}
                    </datalist>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Select
                value={form.watch("deliverableId") || "__ungrouped__"}
                onValueChange={(value) => {
                  if (value === "__create_new__") {
                    setIsCreatingDeliverable(true);
                  } else {
                    form.setValue("deliverableId", value === "__ungrouped__" ? undefined : value);
                  }
                }}
              >
                <SelectTrigger data-testid="select-action-deliverable">
                  <SelectValue placeholder="Ungrouped" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ungrouped__">Ungrouped</SelectItem>
                  {deliverables.filter(d => !d.isDeleted).map((deliverable) => (
                    <SelectItem key={deliverable.id} value={deliverable.id}>
                      {deliverable.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create_new__" className="text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Plus className="h-3 w-3" />
                      Create new deliverable...
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              rows={3}
              data-testid="input-action-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register("dueDate")}
                data-testid="input-action-due-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value)}
              >
                <SelectTrigger data-testid="select-action-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ActionStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effort">Effort (hours)</Label>
            <Input
              id="effort"
              type="number"
              min={0}
              {...form.register("effort", { valueAsNumber: true })}
              data-testid="input-action-effort"
            />
          </div>

          <div className="space-y-2">
            <Label>Owners</Label>
            <ComboboxMultiSelect
              value={owners}
              onChange={(value) => form.setValue("owners", value)}
              options={ownerSuggestions}
              placeholder="Select or add owners..."
              emptyText="No owners found."
              autoFocus={initialFocus === "owner"}
              data-testid="combobox-action-owners"
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
              autoFocus={initialFocus === "label"}
              data-testid="combobox-action-labels"
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
                data-testid="input-action-comment"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!newComment.trim() || addComment.isPending}
                onClick={() => newComment.trim() && addComment.mutate(newComment.trim())}
                data-testid="button-add-action-comment"
              >
                {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteAction.mutate()}
              disabled={deleteAction.isPending}
              data-testid="button-delete-action"
            >
              {deleteAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateAction.isPending || isSubmittingWithNewDeliverable} data-testid="button-save-action">
                {(updateAction.isPending || isSubmittingWithNewDeliverable) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
