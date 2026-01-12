import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Stakeholder } from "@shared/schema";

export function useStakeholderMentions() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allStakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ["/api/stakeholders"],
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
    enabled: searchQuery.length > 0,
  });

  const createStakeholderMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const res = await apiRequest("POST", "/api/stakeholders", data);
      return res.json() as Promise<Stakeholder>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stakeholders"] });
    },
  });

  const filteredStakeholders = useCallback(
    (query: string): Stakeholder[] => {
      const q = query.toLowerCase();
      return allStakeholders.filter((s) => {
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        return fullName.includes(q);
      });
    },
    [allStakeholders]
  );

  const createStakeholder = useCallback(
    async (firstName: string, lastName: string): Promise<Stakeholder> => {
      return createStakeholderMutation.mutateAsync({ firstName, lastName });
    },
    [createStakeholderMutation]
  );

  return {
    allStakeholders,
    searchQuery,
    setSearchQuery,
    searchResults: searchResults.data || [],
    isSearching: searchResults.isLoading,
    filteredStakeholders,
    createStakeholder,
    isCreating: createStakeholderMutation.isPending,
  };
}

export function formatMention(stakeholder: Stakeholder): string {
  return `@[${stakeholder.firstName} ${stakeholder.lastName}](stakeholder:${stakeholder.id})`;
}

export function formatMentionDisplay(stakeholder: Stakeholder): string {
  return `@${stakeholder.firstName}${stakeholder.lastName}`;
}

export function parseMentions(text: string): Array<{ text: string; isMention: boolean; stakeholderId?: string; displayName?: string }> {
  const mentionRegex = /@\[([^\]]+)\]\(stakeholder:([^)]+)\)/g;
  const parts: Array<{ text: string; isMention: boolean; stakeholderId?: string; displayName?: string }> = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isMention: false });
    }
    
    const displayName = match[1];
    const stakeholderId = match[2];
    
    parts.push({
      text: match[0],
      isMention: true,
      displayName: displayName.replace(/\s+/g, ""),
      stakeholderId,
    });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMention: false });
  }
  
  return parts;
}

export function canonicalToDisplay(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(stakeholder:[^)]+\)/g, (_, name) => {
    const compactName = name.replace(/\s+/g, "");
    return `@${compactName}`;
  });
}

export function displayToCanonical(displayText: string, canonicalText: string): string {
  return canonicalText;
}

export function getPlainTextFromMentions(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(stakeholder:[^)]+\)/g, "@$1");
}
