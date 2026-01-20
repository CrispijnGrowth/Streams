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
import { Textarea } from "@/components/ui/textarea";
import { MentionableTextArea } from "@/components/mentionable-textarea";
import { Label } from "@/components/ui/label";
import { ComboboxMultiSelect } from "@/components/ui/combobox-multi-select";
import { OwnerMultiSelect } from "@/components/ui/owner-multi-select";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient, type ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTeamMembers, useLabelSuggestions } from "@/hooks/use-suggestions";
import { StakeholderTagPicker } from "@/components/stakeholder-tag-picker";
import { ViewerPicker } from "@/components/viewer-picker";
import { useAuth } from "@/lib/auth-context";
import type { Stream } from "@shared/schema";

export type EditStreamFocusField = "owner" | "label" | null;

const editStreamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

type EditStreamForm = z.infer<typeof editStreamSchema>;

interface EditStreamDialogProps {
  stream: Stream | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  initialFocus?: EditStreamFocusField;
}

export function EditStreamDialog({ stream, open, onOpenChange, onDeleted, initialFocus }: EditStreamDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const teamMembers = useTeamMembers();
  const labelSuggestions = useLabelSuggestions();

  const form = useForm<EditStreamForm>({
    resolver: zodResolver(editStreamSchema),
    defaultValues: {
      name: "",
      description: "",
      owners: [],
      labels: [],
    },
  });

  useEffect(() => {
    if (stream && open) {
      form.reset({
        name: stream.name,
        description: stream.description || "",
        owners: stream.owners || [],
        labels: stream.labels || [],
      });
    }
  }, [stream, open, form]);

  const updateStream = useMutation({
    mutationFn: async (data: EditStreamForm) => {
      return apiRequest("PATCH", `/api/streams/${stream?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams", stream?.id] });
      toast({ title: "Stream updated successfully" });
      onOpenChange(false);
    },
    onError: (error: ApiError) => {
      toast({ title: error.message || "Failed to update stream", variant: "destructive" });
    },
  });

  const deleteStream = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/streams/${stream?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Stream deleted" });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (error: ApiError) => {
      toast({ title: error.message || "Failed to delete stream", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditStreamForm) => {
    updateStream.mutate(data);
  };

  const owners = form.watch("owners");
  const labels = form.watch("labels");

  if (!stream) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Stream</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              data-testid="input-stream-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (type @ to mention)</Label>
            <MentionableTextArea
              value={form.watch("description") || ""}
              onChange={(value) => form.setValue("description", value)}
              rows={3}
              data-testid="input-stream-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Owners</Label>
            <OwnerMultiSelect
              value={owners}
              onChange={(value) => form.setValue("owners", value)}
              teamMembers={teamMembers}
              placeholder="Select or add owners..."
              emptyText="No owners found."
              autoFocus={initialFocus === "owner"}
              data-testid="combobox-stream-owners"
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
              data-testid="combobox-stream-labels"
            />
          </div>

          {stream?.id && (
            <div className="space-y-2">
              <Label>Tagged Stakeholders</Label>
              <StakeholderTagPicker
                entityType="stream"
                entityId={stream.id}
              />
            </div>
          )}

          {stream?.id && stream?.userId === user?.id && (
            <div className="space-y-2">
              <Label>Viewers (can view this stream)</Label>
              <ViewerPicker
                entityType="stream"
                entityId={stream.id}
              />
            </div>
          )}

          <DialogFooter className="flex justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteStream.mutate()}
              disabled={deleteStream.isPending}
              data-testid="button-delete-stream"
            >
              {deleteStream.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={updateStream.isPending} data-testid="button-save-stream">
                {updateStream.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
