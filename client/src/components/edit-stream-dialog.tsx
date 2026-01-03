import { useState, useEffect, useRef } from "react";
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
import { X, Plus, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
    onError: () => {
      toast({ title: "Failed to update stream", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Failed to delete stream", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditStreamForm) => {
    updateStream.mutate(data);
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              rows={3}
              data-testid="input-stream-description"
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
                    data-testid={`button-remove-owner-${owner}`}
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
              <Button type="button" size="icon" variant="outline" onClick={addOwner} data-testid="button-add-owner">
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
                    data-testid={`button-remove-label-${label}`}
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
              <Button type="button" size="icon" variant="outline" onClick={addLabel} data-testid="button-add-label">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
