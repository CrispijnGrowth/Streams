import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AtSign, X, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Stakeholder, StakeholderTag, TagEntityTypeValue } from "@shared/schema";
import { cn } from "@/lib/utils";

interface CardStakeholderTagsProps {
  entityType: TagEntityTypeValue;
  entityId: string;
  className?: string;
}

export function CardStakeholderTags({
  entityType,
  entityId,
  className = "",
}: CardStakeholderTagsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");

  const { data: allStakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ["/api/stakeholders"],
  });

  const { data: entityTags = [] } = useQuery<StakeholderTag[]>({
    queryKey: ["/api/tags", entityType, entityId],
    enabled: !!entityId,
  });

  const createStakeholderMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const res = await apiRequest("POST", "/api/stakeholders", data);
      return res.json() as Promise<Stakeholder>;
    },
    onSuccess: (newStakeholder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stakeholders"] });
      addTagMutation.mutate(newStakeholder.id);
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
      setSearchQuery("");
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
  const taggedStakeholders = allStakeholders.filter((s) =>
    taggedStakeholderIds.has(s.id)
  );

  const filteredStakeholders = allStakeholders.filter((s) => {
    if (taggedStakeholderIds.has(s.id)) return false;
    if (!searchQuery.trim()) return true;
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  }).slice(0, 6);

  const handleAddTag = (stakeholderId: string) => {
    addTagMutation.mutate(stakeholderId);
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

  const hasExistingTags = taggedStakeholders.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 shrink-0",
            hasExistingTags ? "text-primary" : "text-muted-foreground",
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
          }}
          data-testid={`button-card-tag-${entityType}-${entityId}`}
        >
          <AtSign className="h-3.5 w-3.5" />
          {hasExistingTags && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center font-medium">
              {taggedStakeholders.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        align="start"
        side="top"
        onClick={(e) => e.stopPropagation()}
      >
        {!showCreateForm ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <AtSign className="h-3 w-3" />
              Tag stakeholders
            </div>

            {taggedStakeholders.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {taggedStakeholders.map((stakeholder) => {
                  const tag = entityTags.find((t) => t.stakeholderId === stakeholder.id);
                  return (
                    <Badge
                      key={stakeholder.id}
                      variant="secondary"
                      className="text-xs gap-1 pr-1"
                    >
                      {stakeholder.firstName} {stakeholder.lastName}
                      <button
                        type="button"
                        onClick={() => tag && handleRemoveTag(tag.id)}
                        className="hover:text-destructive"
                        data-testid={`button-remove-tag-${stakeholder.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            <Input
              placeholder="Search stakeholders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-sm"
              autoFocus
            />

            {filteredStakeholders.length > 0 ? (
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {filteredStakeholders.map((stakeholder) => (
                  <button
                    key={stakeholder.id}
                    type="button"
                    className="w-full text-left px-2 py-1 text-sm rounded-sm hover:bg-muted flex items-center gap-2"
                    onClick={() => handleAddTag(stakeholder.id)}
                    data-testid={`button-add-tag-${stakeholder.id}`}
                  >
                    <AtSign className="h-3 w-3 text-muted-foreground" />
                    {stakeholder.firstName} {stakeholder.lastName}
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setShowCreateForm(true);
                  const parts = searchQuery.trim().split(" ");
                  setNewFirstName(parts[0] || "");
                  setNewLastName(parts.slice(1).join(" ") || "");
                }}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Create "{searchQuery.trim()}"
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Create new stakeholder</p>
            <Input
              placeholder="First name"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
            />
            <Input
              placeholder="Last name"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              className="h-7 text-sm"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateStakeholder}
                disabled={!newFirstName.trim() || !newLastName.trim() || createStakeholderMutation.isPending}
                className="flex-1 h-7 text-xs"
              >
                {createStakeholderMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Create & Tag"
                )}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
