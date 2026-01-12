import { useEffect } from "react";
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
import { MentionableTextArea } from "@/components/mentionable-textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StakeholderTagPicker } from "@/components/stakeholder-tag-picker";
import type { Step } from "@shared/schema";

const editStepSchema = z.object({
  name: z.string().min(1, "Name is required"),
  note: z.string().optional(),
  dueDate: z.string().optional(),
  owner: z.string().optional(),
  isDone: z.boolean(),
});

type EditStepForm = z.infer<typeof editStepSchema>;

interface EditStepDialogProps {
  step: Step | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function EditStepDialog({ step, open, onOpenChange, onDeleted }: EditStepDialogProps) {
  const { toast } = useToast();

  const form = useForm<EditStepForm>({
    resolver: zodResolver(editStepSchema),
    defaultValues: {
      name: "",
      note: "",
      dueDate: "",
      owner: "",
      isDone: false,
    },
  });

  useEffect(() => {
    if (step && open) {
      form.reset({
        name: step.name,
        note: step.note || "",
        dueDate: step.dueDate || "",
        owner: step.owner || "",
        isDone: step.isDone,
      });
    }
  }, [step, open, form]);

  const updateStep = useMutation({
    mutationFn: async (data: EditStepForm) => {
      return apiRequest("PATCH", `/api/steps/${step?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/steps", step?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Step updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update step", variant: "destructive" });
    },
  });

  const deleteStep = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/steps/${step?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Step deleted" });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: () => {
      toast({ title: "Failed to delete step", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditStepForm) => {
    updateStep.mutate(data);
  };

  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Step</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              data-testid="input-step-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (type @ to mention)</Label>
            <MentionableTextArea
              value={form.watch("note") || ""}
              onChange={(value) => form.setValue("note", value)}
              rows={3}
              data-testid="input-step-note"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register("dueDate")}
                data-testid="input-step-due-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                {...form.register("owner")}
                placeholder="Owner name"
                data-testid="input-step-owner"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isDone"
              checked={form.watch("isDone")}
              onCheckedChange={(checked) => form.setValue("isDone", checked === true)}
              data-testid="checkbox-step-done"
            />
            <Label htmlFor="isDone" className="cursor-pointer">Mark as done</Label>
          </div>

          {step?.id && (
            <div className="space-y-2">
              <Label>Tagged Stakeholders</Label>
              <StakeholderTagPicker
                entityType="step"
                entityId={step.id}
              />
            </div>
          )}

          <DialogFooter className="flex justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteStep.mutate()}
              disabled={deleteStep.isPending}
              data-testid="button-delete-step"
            >
              {deleteStep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateStep.isPending} data-testid="button-save-step">
                {updateStep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
