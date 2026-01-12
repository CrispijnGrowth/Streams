import { useQuery } from "@tanstack/react-query";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseMentions } from "@/hooks/use-stakeholder-mentions";
import type { Stakeholder } from "@shared/schema";

interface MentionHighlighterProps {
  text: string;
  className?: string;
}

export function MentionHighlighter({ text, className }: MentionHighlighterProps) {
  const { data: stakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ["/api/stakeholders"],
  });

  if (!text) return null;

  const parts = parseMentions(text, stakeholders);

  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {parts.map((part, index) =>
        part.isMention ? (
          <span
            key={index}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/10 text-primary font-medium text-sm"
            data-stakeholder-id={part.stakeholderId}
          >
            <AtSign className="h-3 w-3" />
            {part.displayName}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}
