import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

export type HierarchyLevel = "portfolio" | "stream" | "solution" | "action";

interface LevelConfig {
  level: HierarchyLevel;
  label: string;
  href?: string;
}

const levelLabels: Record<HierarchyLevel, string> = {
  portfolio: "PORTFOLIO",
  stream: "STREAM",
  solution: "SOLUTION",
  action: "ACTION",
};

interface ClassNavigatorProps {
  currentLevel: HierarchyLevel;
  streamId?: string;
  solutionId?: string;
  actionId?: string;
}

export function ClassNavigator({ currentLevel, streamId, solutionId, actionId }: ClassNavigatorProps) {
  const levels: LevelConfig[] = [];

  levels.push({
    level: "portfolio",
    label: levelLabels.portfolio,
    href: currentLevel !== "portfolio" ? "/" : undefined,
  });

  if (currentLevel === "stream" || currentLevel === "solution" || currentLevel === "action") {
    levels.push({
      level: "stream",
      label: levelLabels.stream,
      href: currentLevel !== "stream" && streamId ? `/stream/${streamId}` : undefined,
    });
  }

  if (currentLevel === "solution" || currentLevel === "action") {
    levels.push({
      level: "solution",
      label: levelLabels.solution,
      href: currentLevel !== "solution" && streamId && solutionId ? `/stream/${streamId}/solution/${solutionId}` : undefined,
    });
  }

  if (currentLevel === "action") {
    levels.push({
      level: "action",
      label: levelLabels.action,
    });
  }

  return (
    <nav className="flex items-center gap-3 py-4" aria-label="Hierarchy navigation" data-testid="class-navigator">
      {levels.map((item, index) => {
        const isActive = item.level === currentLevel;
        const isClickable = !!item.href;

        return (
          <div key={item.level} className="flex items-center gap-3">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            )}
            {isClickable ? (
              <Link
                href={item.href!}
                className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`nav-level-${item.level}`}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`text-[10px] uppercase tracking-widest font-semibold ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`nav-level-${item.level}`}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
