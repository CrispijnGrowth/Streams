import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Eye, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ViewerEntityTypeValue, Viewer } from "@shared/schema";

interface ViewerUser {
  id: string;
  email: string;
  name: string;
}

interface ViewerPickerProps {
  entityType: ViewerEntityTypeValue;
  entityId: string;
  className?: string;
}

export function ViewerPicker({
  entityType,
  entityId,
  className = "",
}: ViewerPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allUsers = [] } = useQuery<ViewerUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: entityViewers = [] } = useQuery<Viewer[]>({
    queryKey: ["/api/viewers", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/viewers/${entityType}/${entityId}`, {
        credentials: "include",
        headers: { "x-session-id": localStorage.getItem("streams-session-id") || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch viewers");
      return res.json();
    },
    enabled: !!entityId,
  });

  const addViewerMutation = useMutation({
    mutationFn: async (viewerId: string) => {
      const res = await apiRequest("POST", "/api/viewers", {
        viewerId,
        entityType,
        entityId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/viewers", entityType, entityId] });
    },
  });

  const removeViewerMutation = useMutation({
    mutationFn: async (viewerId: string) => {
      await apiRequest("DELETE", `/api/viewers/${entityType}/${entityId}/${viewerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/viewers", entityType, entityId] });
    },
  });

  const viewerIds = new Set(entityViewers.map((v) => v.viewerId));

  const filteredUsers = allUsers.filter((u) => {
    if (viewerIds.has(u.id)) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
  });

  const viewerUsers = allUsers.filter((u) => viewerIds.has(u.id));

  const handleAddViewer = (viewerId: string) => {
    addViewerMutation.mutate(viewerId);
    setSearchQuery("");
  };

  const handleRemoveViewer = (viewerId: string) => {
    removeViewerMutation.mutate(viewerId);
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {viewerUsers.map((user) => (
          <Badge
            key={user.id}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
            data-testid={`badge-viewer-${user.id}`}
          >
            <Eye className="h-3 w-3" />
            {user.name || user.email}
            <button
              type="button"
              onClick={() => handleRemoveViewer(user.id)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
              data-testid={`button-remove-viewer-${user.id}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              data-testid="button-add-viewer"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Add Viewer
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input
              ref={inputRef}
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
              data-testid="input-search-viewers"
            />

            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleAddViewer(user.id)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover-elevate flex items-center gap-2"
                  data-testid={`button-select-viewer-${user.id}`}
                >
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </button>
              ))}

              {filteredUsers.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  {searchQuery ? "No matches found" : "No users available"}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
