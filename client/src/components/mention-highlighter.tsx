import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface MentionHighlighterProps {
  text: string;
  className?: string;
}

export function MentionHighlighter({ text, className }: MentionHighlighterProps) {
  if (!text) return null;

  const mentionRegex = /@([A-Z][a-z]+ [A-Z][a-z]+|[A-Za-z]+ [A-Za-z]+)/g;
  const parts: Array<{ text: string; isMention: boolean }> = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isMention: false });
    }
    parts.push({
      text: match[0],
      isMention: true,
    });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMention: false });
  }

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
          >
            <AtSign className="h-3 w-3" />
            {part.text.slice(1)}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}
