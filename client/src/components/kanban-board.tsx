import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionCard } from "@/components/action-card";
import { ActionStatus, type ActionWithProgress, type ActionStatusType } from "@shared/schema";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  actions: ActionWithProgress[];
  onActionClick?: (id: string) => void;
  onStatusChange?: (actionId: string, newStatus: ActionStatusType) => void;
  showDescription?: boolean;
}

const kanbanColumns: { status: ActionStatusType; label: string; color: string }[] = [
  { status: ActionStatus.BACKLOG, label: "Backlog", color: "bg-status-backlog" },
  { status: ActionStatus.TO_EXECUTE, label: "To Execute", color: "bg-status-to-execute" },
  { status: ActionStatus.EXECUTING, label: "Doing", color: "bg-status-executing" },
  { status: ActionStatus.BLOCKED, label: "Blocked", color: "bg-status-blocked" },
  { status: ActionStatus.DELEGATED, label: "Delegated", color: "bg-status-delegated" },
  { status: ActionStatus.DONE, label: "Done", color: "bg-status-done" },
  { status: ActionStatus.ARCHIVE, label: "Archive", color: "bg-status-archive" },
];

export function KanbanBoard({
  actions,
  onActionClick,
  onStatusChange,
  showDescription = true,
}: KanbanBoardProps) {
  const columnData = useMemo(() => {
    return kanbanColumns.map((col) => ({
      ...col,
      items: actions
        .filter((a) => a.status === col.status)
        .sort((a, b) => a.kanbanOrder - b.kanbanOrder),
    }));
  }, [actions]);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {columnData.map((column) => (
          <div
            key={column.status}
            className="w-72 flex-shrink-0"
            data-testid={`kanban-column-${column.status.toLowerCase().replace(" ", "-")}`}
          >
            <div className="sticky top-0 bg-background z-10 pb-2">
              <div className="flex items-center gap-2 p-2">
                <div className={`w-2 h-2 rounded-full ${column.color}`} />
                <h3 className="font-medium text-sm">{column.label}</h3>
                <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-auto">
                  {column.items.length}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 min-h-[200px] p-1">
              {column.items.length === 0 ? (
                <div className="h-32 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">No items</span>
                </div>
              ) : (
                column.items.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onClick={() => onActionClick?.(action.id)}
                    showDescription={showDescription}
                    showDragHandle
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
