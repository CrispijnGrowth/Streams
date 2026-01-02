import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Deliverable } from "@shared/schema";
import { Phases, ActionStatus } from "@shared/schema";

const editDeliverableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  milestoneDate: z.string().optional(),
  status: z.string(),
  phases: z.array(z.string()).default([]),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

type EditDeliverableForm = z.infer<typeof editDeliverableSchema>;

interface EditDeliverableDialogProps {
  deliverable: Deliverable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function EditDeliverableDialog({ deliverable, open, onOpenChange, onDeleted }: EditDeliverableDialogProps) {
  const { toast } = useToast();
  const [newOwner, setNewOwner] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const form = useForm<EditDeliverableForm>({
    resolver: zodResolver(editDeliverableSchema),
    defaultValues: {
      name: "",
      description: "",
      milestoneDate: "",
      status: ActionStatus.BACKLOG,
      phases: [],
      owners: [],
      labels: [],
    },
  });

  useEffect(() => {
    if (deliverable && open) {
      form.reset({
        name: deliverable.name,
        description: deliverable.description || "",
        milestoneDate: deliverable.milestoneDate || "",
        status: deliverable.status,
        phases: deliverable.phases || [],
        owners: deliverable.owners || [],
        labels: deliverable.labels || [],
      });
    }
  }, [deliverable, open, form]);

  const updateDeliverable = useMutation({
    mutationFn: async (data: EditDeliverableForm) => {
      return apiRequest("PATCH", `/api/deliverables/${deliverable?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", deliverable?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Deliverable updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update deliverable", variant: "destructive" });
    },
  });

  const deleteDeliverable = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/deliverables/${deliverable?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Deliverable deleted" });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: () => {
      toast({ title: "Failed to delete deliverable", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditDeliverableForm) => {
    updateDeliverable.mutate(data);
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

  const togglePhase = (phase: string) => {
    const current = form.getValues("phases");
    if (current.includes(phase)) {
      form.setValue("phases", current.filter((p) => p !== phase));
    } else {
      form.setValue("phases", [...current, phase]);
    }
  };

  const phases = form.watch("phases");
  const owners = form.watch("owners");
  const labels = form.watch("labels");

  if (!deliverable) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Deliverable</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              data-testid="input-deliverable-name"
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
              data-testid="input-deliverable-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="milestoneDate">Milestone Date</Label>
              <Input
                id="milestoneDate"
                type="date"
                {...form.register("milestoneDate")}
                data-testid="input-deliverable-milestone-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value)}
              >
                <SelectTrigger data-testid="select-deliverable-status">
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
            <Label>Phases</Label>
            <div className="flex flex-wrap gap-2">
              {Object.values(Phases).map((phase) => (
                <div key={phase} className="flex items-center gap-2">
                  <Checkbox
                    id={`phase-${phase}`}
                    checked={phases.includes(phase)}
                    onCheckedChange={() => togglePhase(phase)}
                    data-testid={`checkbox-phase-${phase}`}
                  />
                  <Label htmlFor={`phase-${phase}`} className="text-sm font-normal cursor-pointer">
                    {phase}
                  </Label>
                </div>
              ))}
            </div>
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
              onClick={() => deleteDeliverable.mutate()}
              disabled={deleteDeliverable.isPending}
              data-testid="button-delete-deliverable"
            >
              {deleteDeliverable.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateDeliverable.isPending} data-testid="button-save-deliverable">
                {updateDeliverable.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
