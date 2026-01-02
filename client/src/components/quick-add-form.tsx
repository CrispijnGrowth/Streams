import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

interface QuickAddFormProps {
  placeholder: string;
  onAdd: (name: string) => void;
  isLoading?: boolean;
}

export interface QuickAddFormRef {
  focus: () => void;
}

export const QuickAddForm = forwardRef<QuickAddFormRef, QuickAddFormProps>(
  function QuickAddForm({ placeholder, onAdd, isLoading = false }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setValue("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground"
        onClick={() => setIsOpen(true)}
        data-testid="button-quick-add"
      >
        <Plus className="h-4 w-4" />
        {placeholder}
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-9"
        disabled={isLoading}
        data-testid="input-quick-add"
      />
      <Button
        type="submit"
        size="sm"
        disabled={!value.trim() || isLoading}
        data-testid="button-quick-add-submit"
      >
        Add
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCancel}
        disabled={isLoading}
        data-testid="button-quick-add-cancel"
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
});
