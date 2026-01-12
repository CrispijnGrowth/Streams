import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, UserPlus, AtSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Stakeholder, StakeholderTag, TagEntityTypeValue } from "@shared/schema";

interface StakeholderTagPickerProps {
  entityType: TagEntityTypeValue;
  entityId: string;
  className?: string;
}

export function StakeholderTagPicker({
  entityType,
  entityId,
  className = "",
}: StakeholderTagPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allStakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ["/api/stakeholders"],
  });

  const { data: entityTags = [] } = useQuery<StakeholderTag[]>({
    queryKey: ["/api/tags", entityType, entityId],
    enabled: !!entityId,
  });

  const searchResults = useQuery<Stakeholder[]>({
    queryKey: ["/api/stakeholders/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return allStakeholders;
      const response = await fetch(`/api/stakeholders/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
        headers: { "x-session-id": localStorage.getItem("streams-session-id") || "" },
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: isOpen,
  });

  const createStakeholderMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const res = await apiRequest("POST", "/api/stakeholders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stakeholders"] });
      setNewFirstName("");
      setNewLastName("");
      setShowCreateForm(false);
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async (stakeholderId: string) => {
      const res = await apiRequest("POST", "/api/tags", {
        stakeholderId,
        entityType,
        entityId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags", entityType, entityId] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      await apiRequest("DELETE", `/api/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags", entityType, entityId] });
    },
  });

  const taggedStakeholderIds = new Set(entityTags.map((t) => t.stakeholderId));

  const filteredStakeholders = (searchResults.data || allStakeholders).filter(
    (s) => !taggedStakeholderIds.has(s.id)
  );

  const taggedStakeholders = allStakeholders.filter((s) =>
    taggedStakeholderIds.has(s.id)
  );

  const handleAddTag = (stakeholderId: string) => {
    addTagMutation.mutate(stakeholderId);
    setSearchQuery("");
  };

  const handleRemoveTag = (tagId: string) => {
    removeTagMutation.mutate(tagId);
  };

  const handleCreateStakeholder = () => {
    if (newFirstName.trim() && newLastName.trim()) {
      createStakeholderMutation.mutate({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
      });
    }
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {taggedStakeholders.map((stakeholder) => {
          const tag = entityTags.find((t) => t.stakeholderId === stakeholder.id);
          return (
            <Badge
              key={stakeholder.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
              data-testid={`badge-stakeholder-${stakeholder.id}`}
            >
              <AtSign className="h-3 w-3" />
              {stakeholder.firstName} {stakeholder.lastName}
              <button
                type="button"
                onClick={() => tag && handleRemoveTag(tag.id)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                data-testid={`button-remove-stakeholder-${stakeholder.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              data-testid="button-add-stakeholder"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input
              ref={inputRef}
              placeholder="Search stakeholders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
              data-testid="input-search-stakeholders"
            />

            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredStakeholders.map((stakeholder) => (
                <button
                  key={stakeholder.id}
                  type="button"
                  onClick={() => handleAddTag(stakeholder.id)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover-elevate flex items-center gap-2"
                  data-testid={`button-select-stakeholder-${stakeholder.id}`}
                >
                  <AtSign className="h-3 w-3 text-muted-foreground" />
                  {stakeholder.firstName} {stakeholder.lastName}
                </button>
              ))}

              {filteredStakeholders.length === 0 && !showCreateForm && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  {searchQuery ? "No matches found" : "No stakeholders yet"}
                </div>
              )}
            </div>

            {!showCreateForm ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => setShowCreateForm(true)}
                data-testid="button-show-create-stakeholder"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Add new stakeholder
              </Button>
            ) : (
              <div className="mt-2 space-y-2 border-t pt-2">
                <Input
                  placeholder="First name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-new-stakeholder-firstname"
                />
                <Input
                  placeholder="Last name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-new-stakeholder-lastname"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={handleCreateStakeholder}
                    disabled={!newFirstName.trim() || !newLastName.trim()}
                    data-testid="button-create-stakeholder"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewFirstName("");
                      setNewLastName("");
                    }}
                    data-testid="button-cancel-create-stakeholder"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
