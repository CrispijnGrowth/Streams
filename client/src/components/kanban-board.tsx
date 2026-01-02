import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { ActionCard } from "@/components/action-card";
import { ActionStatus, type ActionWithProgress, type ActionStatusType } from "@shared/schema";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  actions: ActionWithProgress[];
  onActionClick?: (id: string) => void;
  onActionEdit?: (action: ActionWithProgress) => void;
  onStatusChange?: (actionId: string, newStatus: ActionStatusType) => void;
  onReorder?: (actionId: string, newKanbanOrder: number) => void;
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

interface SortableActionCardProps {
  action: ActionWithProgress;
  onClick?: () => void;
  onEdit?: () => void;
  showDescription?: boolean;
}

function SortableActionCard({ action, onClick, onEdit, showDescription }: SortableActionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ActionCard
        action={action}
        onClick={onClick}
        onEdit={onEdit}
        showDescription={showDescription}
        isDragging={isDragging}
        showDragHandle
      />
    </div>
  );
}

interface DroppableColumnProps {
  id: string;
  status: ActionStatusType;
  label: string;
  color: string;
  items: ActionWithProgress[];
  onActionClick?: (id: string) => void;
  onActionEdit?: (action: ActionWithProgress) => void;
  showDescription?: boolean;
}

function DroppableColumn({
  id,
  status,
  label,
  color,
  items,
  onActionClick,
  onActionEdit,
  showDescription,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className="w-72 flex-shrink-0"
      data-testid={`kanban-column-${status.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="sticky top-0 bg-background z-10 pb-2">
        <div className="flex items-center gap-2 p-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="font-medium text-sm">{label}</h3>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-auto">
            {items.length}
          </Badge>
        </div>
      </div>
      <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`space-y-3 min-h-[200px] p-1 rounded-lg transition-colors ${
            isOver ? "bg-accent/30" : ""
          }`}
        >
          {items.length === 0 ? (
            <div className={`h-32 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
              isOver ? "border-primary/50 bg-primary/5" : "border-border/50"
            }`}>
              <span className="text-xs text-muted-foreground">Drop here</span>
            </div>
          ) : (
            items.map((action) => (
              <SortableActionCard
                key={action.id}
                action={action}
                onClick={() => onActionClick?.(action.id)}
                onEdit={() => onActionEdit?.(action)}
                showDescription={showDescription}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  actions,
  onActionClick,
  onActionEdit,
  onStatusChange,
  onReorder,
  showDescription = true,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const columnData = useMemo(() => {
    return kanbanColumns.map((col) => ({
      ...col,
      id: `column-${col.status}`,
      items: actions
        .filter((a) => a.status === col.status)
        .sort((a, b) => a.kanbanOrder - b.kanbanOrder),
    }));
  }, [actions]);

  const activeAction = useMemo(() => {
    if (!activeId) return null;
    return actions.find((a) => a.id === activeId) || null;
  }, [activeId, actions]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedAction = actions.find((a) => a.id === active.id);
    if (!draggedAction) return;

    const overId = over.id as string;

    if (overId.startsWith("column-")) {
      const newStatus = overId.replace("column-", "") as ActionStatusType;
      if (draggedAction.status !== newStatus) {
        onStatusChange?.(draggedAction.id, newStatus);
      }
      return;
    }

    const overAction = actions.find((a) => a.id === overId);
    if (!overAction) return;

    if (draggedAction.status !== overAction.status) {
      onStatusChange?.(draggedAction.id, overAction.status);
    } else if (draggedAction.id !== overAction.id) {
      const column = columnData.find((c) => c.status === draggedAction.status);
      if (!column) return;

      const oldIndex = column.items.findIndex((a) => a.id === draggedAction.id);
      const newIndex = column.items.findIndex((a) => a.id === overAction.id);

      if (oldIndex !== newIndex && onReorder) {
        const reordered = arrayMove(column.items, oldIndex, newIndex);
        reordered.forEach((item, index) => {
          if (item.kanbanOrder !== index + 1) {
            onReorder(item.id, index + 1);
          }
        });
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {columnData.map((column) => (
            <DroppableColumn
              key={column.status}
              id={column.id}
              status={column.status}
              label={column.label}
              color={column.color}
              items={column.items}
              onActionClick={onActionClick}
              onActionEdit={onActionEdit}
              showDescription={showDescription}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay>
        {activeAction && (
          <ActionCard
            action={activeAction}
            showDescription={showDescription}
            isDragging
            showDragHandle
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
