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
import { Plus, Loader2, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOwnerSuggestions, useLabelSuggestions } from "@/hooks/use-suggestions";
import type { Action, Deliverable } from "@shared/schema";
import { ActionStatus } from "@shared/schema";

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
  const [isCreatingDeliverable, setIsCreatingDeliverable] = useState(false);
  const [isSubmittingWithNewDeliverable, setIsSubmittingWithNewDeliverable] = useState(false);
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

  const createDeliverable = useMutation({
    mutationFn: async (name: string) => {
      const deliverableResponse = await apiRequest("POST", "/api/deliverables", {
        name,
        solutionId: action?.solutionId,
        streamId: action?.streamId,
      });
      const newDeliverable = await deliverableResponse.json();
      await apiRequest("PATCH", `/api/actions/${action?.id}`, {
        deliverableId: newDeliverable.id,
      });
      return newDeliverable;
    },
    onSuccess: async (newDeliverable) => {
      queryClient.invalidateQueries({ queryKey: ["/api/solutions", action?.solutionId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions", action?.id] });
      form.setValue("deliverableId", newDeliverable.id);
      setNewDeliverableName("");
      setIsCreatingDeliverable(false);
      toast({ title: "Deliverable created and assigned" });
    },
    onError: () => {
      toast({ title: "Failed to create deliverable", variant: "destructive" });
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
      setIsCreatingDeliverable(false);
      setNewDeliverableName("");
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

  const onSubmit = async (data: EditActionForm) => {
    if (isCreatingDeliverable && newDeliverableName.trim()) {
      setIsSubmittingWithNewDeliverable(true);
      try {
        const deliverableResponse = await apiRequest("POST", "/api/deliverables", {
          name: newDeliverableName.trim(),
          solutionId: action?.solutionId,
          streamId: action?.streamId,
        });
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
              <div className="flex gap-2">
                <Input
                  placeholder="New deliverable name..."
                  value={newDeliverableName}
                  onChange={(e) => setNewDeliverableName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newDeliverableName.trim()) {
                        createDeliverable.mutate(newDeliverableName.trim());
                      }
                    } else if (e.key === "Escape") {
                      setIsCreatingDeliverable(false);
                      setNewDeliverableName("");
                    }
                  }}
                  autoFocus
                  data-testid="input-new-deliverable"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    if (newDeliverableName.trim()) {
                      createDeliverable.mutate(newDeliverableName.trim());
                    }
                  }}
                  disabled={createDeliverable.isPending || !newDeliverableName.trim()}
                >
                  {createDeliverable.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingDeliverable(false);
                    setNewDeliverableName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
