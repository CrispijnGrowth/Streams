import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Stream, Solution, Action, TeamMember } from "@shared/schema";

export function useOwnerSuggestions(): string[] {
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ["/api/team-members"] });

  return useMemo(() => {
    return teamMembers.map((m) => m.name).sort();
  }, [teamMembers]);
}

export function useTeamMembers(): TeamMember[] {
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ["/api/team-members"] });
  return teamMembers;
}

export const DEFAULT_LABELS = ["Service", "Solution", "Tool"] as const;

export function getLabelColor(label: string): string {
  switch (label) {
    case "Service":
      return "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "Solution":
      return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
    case "Tool":
      return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    default:
      return "";
  }
}

export function useLabelSuggestions(): string[] {
  const { data: streams = [] } = useQuery<Stream[]>({ queryKey: ["/api/streams"] });
  const { data: solutions = [] } = useQuery<Solution[]>({ queryKey: ["/api/solutions"] });
  const { data: actions = [] } = useQuery<Action[]>({ queryKey: ["/api/actions"] });

  return useMemo(() => {
    const labels = new Set<string>(DEFAULT_LABELS);
    streams.forEach((s) => s.labels?.forEach((l) => labels.add(l)));
    solutions.forEach((s) => s.labels?.forEach((l) => labels.add(l)));
    actions.forEach((a) => a.labels?.forEach((l) => labels.add(l)));
    return Array.from(labels).sort();
  }, [streams, solutions, actions]);
}
