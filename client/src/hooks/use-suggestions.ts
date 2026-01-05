import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Stream, Solution, Action } from "@shared/schema";

export function useOwnerSuggestions(): string[] {
  const { data: streams = [] } = useQuery<Stream[]>({ queryKey: ["/api/streams"] });
  const { data: solutions = [] } = useQuery<Solution[]>({ queryKey: ["/api/solutions"] });
  const { data: actions = [] } = useQuery<Action[]>({ queryKey: ["/api/actions"] });

  return useMemo(() => {
    const owners = new Set<string>();
    streams.forEach((s) => s.owners?.forEach((o) => owners.add(o)));
    solutions.forEach((s) => s.owners?.forEach((o) => owners.add(o)));
    actions.forEach((a) => a.owners?.forEach((o) => owners.add(o)));
    return Array.from(owners).sort();
  }, [streams, solutions, actions]);
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
