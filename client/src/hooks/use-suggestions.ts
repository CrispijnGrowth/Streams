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

export function useLabelSuggestions(): string[] {
  const { data: streams = [] } = useQuery<Stream[]>({ queryKey: ["/api/streams"] });
  const { data: solutions = [] } = useQuery<Solution[]>({ queryKey: ["/api/solutions"] });
  const { data: actions = [] } = useQuery<Action[]>({ queryKey: ["/api/actions"] });

  return useMemo(() => {
    const labels = new Set<string>();
    streams.forEach((s) => s.labels?.forEach((l) => labels.add(l)));
    solutions.forEach((s) => s.labels?.forEach((l) => labels.add(l)));
    actions.forEach((a) => a.labels?.forEach((l) => labels.add(l)));
    return Array.from(labels).sort();
  }, [streams, solutions, actions]);
}
