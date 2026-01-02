import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Layers, Package, CheckSquare, ListChecks } from "lucide-react";
import type {
  StreamWithProgress,
  DeliverableWithProgress,
  ActionWithProgress,
  Step,
} from "@shared/schema";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SearchResult = {
  type: "stream" | "deliverable" | "action" | "step";
  id: string;
  name: string;
  description?: string;
  path: string;
  parentInfo?: string;
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  const { data: streams } = useQuery<StreamWithProgress[]>({
    queryKey: ["/api/streams"],
  });

  const { data: allActions } = useQuery<ActionWithProgress[]>({
    queryKey: ["/api/actions"],
  });

  const { data: allSteps } = useQuery<Step[]>({
    queryKey: ["/api/steps"],
  });

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    streams?.filter((s) => !s.isDeleted).forEach((stream) => {
      if (
        stream.name.toLowerCase().includes(lowerQuery) ||
        stream.description?.toLowerCase().includes(lowerQuery) ||
        stream.key.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          type: "stream",
          id: stream.id,
          name: stream.name,
          description: stream.description,
          path: `/stream/${stream.id}`,
          parentInfo: stream.key,
        });
      }
    });

    allActions?.filter((a) => !a.isDeleted).forEach((action) => {
      if (
        action.name.toLowerCase().includes(lowerQuery) ||
        action.description?.toLowerCase().includes(lowerQuery)
      ) {
        const stream = streams?.find((s) => {
          return true;
        });
        results.push({
          type: "action",
          id: action.id,
          name: action.name,
          description: action.description,
          path: `/stream/${action.streamId}/deliverable/${action.deliverableId}/action/${action.id}`,
          parentInfo: action.status,
        });
      }
    });

    allSteps?.filter((s) => !s.isDeleted).forEach((step) => {
      if (
        step.name.toLowerCase().includes(lowerQuery) ||
        step.note?.toLowerCase().includes(lowerQuery)
      ) {
        const action = allActions?.find((a) => a.id === step.actionId);
        results.push({
          type: "step",
          id: step.id,
          name: step.name,
          description: step.note,
          path: action
            ? `/stream/${action.streamId}/deliverable/${action.deliverableId}/action/${action.id}`
            : "#",
          parentInfo: step.isDone ? "Done" : "Pending",
        });
      }
    });

    return results.slice(0, 20);
  }, [query, streams, allActions, allSteps]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setLocation(result.path);
      onOpenChange(false);
      setQuery("");
    },
    [setLocation, onOpenChange]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "stream":
        return <Layers className="h-4 w-4 text-muted-foreground" />;
      case "deliverable":
        return <Package className="h-4 w-4 text-muted-foreground" />;
      case "action":
        return <CheckSquare className="h-4 w-4 text-muted-foreground" />;
      case "step":
        return <ListChecks className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "stream":
        return "Stream";
      case "deliverable":
        return "Deliverable";
      case "action":
        return "Action";
      case "step":
        return "Step";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search streams, actions, steps..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 px-0 text-base"
            autoFocus
            data-testid="input-global-search"
          />
        </div>
        <ScrollArea className="max-h-80">
          {results.length === 0 && query.trim() && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No results found for "{query}"
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Start typing to search...
            </div>
          )}
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              className="w-full flex items-start gap-3 p-3 text-left hover-elevate active-elevate-2"
              onClick={() => handleSelect(result)}
              data-testid={`search-result-${result.type}-${result.id}`}
            >
              <div className="mt-0.5">{getIcon(result.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {result.name}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {getTypeLabel(result.type)}
                  </Badge>
                </div>
                {result.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {result.description}
                  </p>
                )}
                {result.parentInfo && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {result.parentInfo}
                  </p>
                )}
              </div>
            </button>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
