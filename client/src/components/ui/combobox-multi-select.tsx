import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  creatable?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function ComboboxMultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  emptyText = "No options found.",
  creatable = true,
  className,
  "data-testid": testId,
}: ComboboxMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const filteredOptions = useMemo(() => {
    const lowerInput = inputValue.toLowerCase();
    return options.filter(
      (option) =>
        option.toLowerCase().includes(lowerInput) && !value.includes(option)
    );
  }, [options, inputValue, value]);

  const canCreate =
    creatable &&
    inputValue.trim() &&
    !options.some((o) => o.toLowerCase() === inputValue.toLowerCase()) &&
    !value.some((v) => v.toLowerCase() === inputValue.toLowerCase());

  const handleSelect = (selectedValue: string) => {
    if (!value.includes(selectedValue)) {
      onChange([...value, selectedValue]);
    }
    setInputValue("");
  };

  const handleCreate = () => {
    if (canCreate) {
      onChange([...value, inputValue.trim()]);
      setInputValue("");
    }
  };

  const handleRemove = (itemToRemove: string) => {
    onChange(value.filter((v) => v !== itemToRemove));
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between font-normal"
            data-testid={testId}
          >
            <span className="text-muted-foreground truncate">
              {value.length > 0 ? `${value.length} selected` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Type to search${creatable ? " or add..." : "..."}`}
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {canCreate ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover-elevate cursor-pointer rounded-sm"
                    onClick={handleCreate}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add &quot;{inputValue.trim()}&quot;</span>
                  </button>
                ) : (
                  emptyText
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(option) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
                {canCreate && filteredOptions.length > 0 && (
                  <CommandItem
                    value={`__create__${inputValue}`}
                    onSelect={handleCreate}
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add &quot;{inputValue.trim()}&quot;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                data-testid={`button-remove-${testId}-${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
