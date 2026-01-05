import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxMultiSelect } from "@/components/ui/combobox-multi-select";
import { useOwnerSuggestions } from "@/hooks/use-suggestions";
import { DeliverableBorderColor, type Deliverable, type DeliverableBorderColorType } from "@shared/schema";
import { Loader2, Trash2 } from "lucide-react";

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
  onSave: (id: string, data: { name: string; borderColor: DeliverableBorderColorType; owners: string[] }) => void;
  onDelete?: (id: string) => void;
  isPending?: boolean;
  anchorElement?: HTMLElement | null;
}

export function EditDeliverablePopup({
  deliverable,
  open,
  onOpenChange,
  onSave,
  onDelete,
  isPending = false,
}: EditDeliverablePopupProps) {
  const [name, setName] = useState("");
  const [borderColor, setBorderColor] = useState<DeliverableBorderColorType>("cyan");
  const [owners, setOwners] = useState<string[]>([]);
  const ownerSuggestions = useOwnerSuggestions();

  useEffect(() => {
    if (deliverable && open) {
      setName(deliverable.name);
      setBorderColor(deliverable.borderColor || "cyan");
      setOwners(deliverable.owners || []);
    }
  }, [deliverable, open]);

  const handleSave = () => {
    if (deliverable && name.trim()) {
      onSave(deliverable.id, { name: name.trim(), borderColor, owners });
      onOpenChange(false);
    }
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
                disabled={!name.trim() || isPending}
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
