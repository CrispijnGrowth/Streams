import { useState, useMemo, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TeamMember } from "@shared/schema";

interface OwnerMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  teamMembers: TeamMember[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  autoFocus?: boolean;
  "data-testid"?: string;
}

export function OwnerMultiSelect({
  value,
  onChange,
  teamMembers,
  placeholder = "Select or add owners...",
  emptyText = "No owners found.",
  className,
  autoFocus = false,
  "data-testid": testId,
}: OwnerMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasAutoFocused = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (autoFocus && !hasAutoFocused.current) {
      hasAutoFocused.current = true;
      setTimeout(() => {
        setOpen(true);
      }, 100);
    }
  }, [autoFocus]);

  const options = useMemo(() => {
    return teamMembers.map((m) => m.name).sort();
  }, [teamMembers]);

  const filteredMembers = useMemo(() => {
    const lowerInput = inputValue.toLowerCase();
    return teamMembers
      .filter(
        (member) =>
          member.name.toLowerCase().includes(lowerInput) && !value.includes(member.name)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers, inputValue, value]);

  const canCreate =
    inputValue.trim() &&
    !options.some((o) => o.toLowerCase() === inputValue.toLowerCase()) &&
    !value.some((v) => v.toLowerCase() === inputValue.toLowerCase());

  const createTeamMemberMutation = useMutation({
    mutationFn: async (data: { name: string; role?: string }) => {
      const res = await apiRequest("POST", "/api/team-members", data);
      return res.json();
    },
    onSuccess: (newMember: TeamMember) => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      onChange([...value, newMember.name]);
      setShowCreateForm(false);
      setNewFirstName("");
      setNewLastName("");
      setNewRole("");
      setInputValue("");
      toast({ title: `Team member "${newMember.name}" created and added as owner` });
    },
    onError: () => {
      toast({ title: "Failed to create team member", variant: "destructive" });
    },
  });

  const handleSelect = (memberName: string) => {
    if (!value.includes(memberName)) {
      onChange([...value, memberName]);
    }
    setInputValue("");
  };

  const handleStartCreate = () => {
    const parts = inputValue.trim().split(" ");
    setNewFirstName(parts[0] || "");
    setNewLastName(parts.slice(1).join(" ") || "");
    setNewRole("");
    setShowCreateForm(true);
  };

  const handleCreateTeamMember = () => {
    const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim();
    if (fullName) {
      createTeamMemberMutation.mutate({
        name: fullName,
        role: newRole.trim() || undefined,
      });
    }
  };

  const handleRemove = (itemToRemove: string) => {
    onChange(value.filter((v) => v !== itemToRemove));
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setNewFirstName("");
    setNewLastName("");
    setNewRole("");
  };

  const getTeamMemberByName = (name: string): TeamMember | undefined => {
    return teamMembers.find((m) => m.name === name);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setShowCreateForm(false);
          setNewFirstName("");
          setNewLastName("");
          setNewRole("");
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
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
          {showCreateForm ? (
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Create new team member</p>
              <Input
                placeholder="First name"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                data-testid="input-owner-first-name"
              />
              <Input
                placeholder="Last name"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-owner-last-name"
              />
              <Input
                placeholder="Role (optional)"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-owner-role"
              />
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelCreate}
                  className="flex-1"
                  data-testid="button-cancel-create-owner"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateTeamMember}
                  disabled={!newFirstName.trim() || !newLastName.trim() || createTeamMemberMutation.isPending}
                  className="flex-1"
                  data-testid="button-create-owner"
                >
                  {createTeamMemberMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create & Add"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Type to search or add..."
                value={inputValue}
                onValueChange={setInputValue}
              />
              <CommandList>
                <CommandEmpty>
                  {canCreate ? (
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover-elevate cursor-pointer rounded-sm"
                      onClick={handleStartCreate}
                      data-testid="button-start-create-owner"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create &quot;{inputValue.trim()}&quot; as team member</span>
                    </button>
                  ) : (
                    emptyText
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredMembers.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={member.name}
                      onSelect={() => handleSelect(member.name)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Avatar className="h-6 w-6">
                          {member.photoData || member.photoUrl ? (
                            <AvatarImage src={member.photoData || member.photoUrl || ""} alt={member.name} />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{member.name}</div>
                          {member.role && (
                            <div className="text-xs text-muted-foreground truncate">{member.role}</div>
                          )}
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value.includes(member.name) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                  {canCreate && filteredMembers.length > 0 && (
                    <CommandItem
                      value={`__create__${inputValue}`}
                      onSelect={handleStartCreate}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create &quot;{inputValue.trim()}&quot; as team member
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((item) => {
            const member = getTeamMemberByName(item);
            return (
              <Badge
                key={item}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {member && (member.photoData || member.photoUrl) && (
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={member.photoData || member.photoUrl || ""} alt={item} />
                    <AvatarFallback className="text-[8px]">
                      {item.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
