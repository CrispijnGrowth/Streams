import { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  const [newOwner, setNewOwner] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const ownerInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && initialFocus) {
      setTimeout(() => {
        if (initialFocus === "owner") {
          ownerInputRef.current?.focus();
        } else if (initialFocus === "label") {
          labelInputRef.current?.focus();
        }
      }, 100);
    }
  }, [open, initialFocus]);

  const { data: deliverables = [] } = useQuery<Deliverable[]>({
    queryKey: ["/api/deliverables", { solutionId: action?.solutionId }],
    enabled: !!action?.solutionId && open,
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
      onOpenChange(false);
    },
    onError: () => {
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

  const onSubmit = (data: EditActionForm) => {
    updateAction.mutate(data);
  };

  const addOwner = () => {
    if (newOwner.trim()) {
      const current = form.getValues("owners");
      if (!current.includes(newOwner.trim())) {
        form.setValue("owners", [...current, newOwner.trim()]);
      }
      setNewOwner("");
    }
  };

  const removeOwner = (owner: string) => {
    const current = form.getValues("owners");
    form.setValue("owners", current.filter((o) => o !== owner));
  };

  const addLabel = () => {
    if (newLabel.trim()) {
      const current = form.getValues("labels");
      if (!current.includes(newLabel.trim())) {
        form.setValue("labels", [...current, newLabel.trim()]);
      }
      setNewLabel("");
    }
  };

  const removeLabel = (label: string) => {
    const current = form.getValues("labels");
    form.setValue("labels", current.filter((l) => l !== label));
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
            <Select
              value={form.watch("deliverableId") || ""}
              onValueChange={(value) => form.setValue("deliverableId", value === "" ? undefined : value)}
            >
              <SelectTrigger data-testid="select-action-deliverable">
                <SelectValue placeholder="Ungrouped" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Ungrouped</SelectItem>
                {deliverables.filter(d => !d.isDeleted).map((deliverable) => (
                  <SelectItem key={deliverable.id} value={deliverable.id}>
                    {deliverable.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="flex flex-wrap gap-1 mb-2">
              {owners.map((owner) => (
                <Badge key={owner} variant="secondary" className="gap-1">
                  {owner}
                  <button
                    type="button"
                    onClick={() => removeOwner(owner)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                ref={ownerInputRef}
                placeholder="Add owner..."
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOwner();
                  }
                }}
                data-testid="input-new-owner"
              />
              <Button type="button" size="icon" variant="outline" onClick={addOwner}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Labels</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {labels.map((label) => (
                <Badge key={label} variant="outline" className="gap-1">
                  {label}
                  <button
                    type="button"
                    onClick={() => removeLabel(label)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                ref={labelInputRef}
                placeholder="Add label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLabel();
                  }
                }}
                data-testid="input-new-label"
              />
              <Button type="button" size="icon" variant="outline" onClick={addLabel}>
                <Plus className="h-4 w-4" />
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
              <Button type="submit" disabled={updateAction.isPending} data-testid="button-save-action">
                {updateAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
