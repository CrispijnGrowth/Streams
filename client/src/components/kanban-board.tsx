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
import { ActionCard } from "@/components/action-card";
import { ActionStatus, type ActionWithProgress, type ActionStatusType, type Deliverable } from "@shared/schema";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  actions: ActionWithProgress[];
  deliverables?: Deliverable[];
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

interface DroppableCellProps {
  id: string;
  status: ActionStatusType;
  items: ActionWithProgress[];
  onActionClick?: (id: string) => void;
  onActionEdit?: (action: ActionWithProgress) => void;
  showDescription?: boolean;
}

function DroppableCell({
  id,
  status,
  items,
  onActionClick,
  onActionEdit,
  showDescription,
}: DroppableCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={`w-72 flex-shrink-0 space-y-2 min-h-[60px] p-1 rounded-lg transition-colors ${
          isOver ? "bg-accent/30" : ""
        }`}
        data-testid={`kanban-cell-${status.toLowerCase().replace(/\s/g, "-")}`}
      >
        {items.length === 0 ? (
          <div className={`h-16 border border-dashed rounded-lg flex items-center justify-center transition-colors ${
            isOver ? "border-primary/50 bg-primary/5" : "border-border/30"
          }`}>
            <span className="text-xs text-muted-foreground/50">Drop here</span>
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
  );
}

interface DeliverableRowProps {
  deliverable: Deliverable | null;
  actions: ActionWithProgress[];
  columnData: { status: ActionStatusType; label: string; color: string; id: string }[];
  onActionClick?: (id: string) => void;
  onActionEdit?: (action: ActionWithProgress) => void;
  showDescription?: boolean;
}

function DeliverableRow({
  deliverable,
  actions,
  columnData,
  onActionClick,
  onActionEdit,
  showDescription,
}: DeliverableRowProps) {
  const rowId = deliverable?.id || "ungrouped";
  
  return (
    <div 
      className="relative flex gap-4 py-3"
      data-testid={`deliverable-row-${rowId}`}
    >
      <div 
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          border: deliverable ? "2px solid" : "none",
          borderColor: deliverable ? "hsl(var(--deliverable-border))" : "transparent",
          boxShadow: deliverable ? "0 0 8px hsl(var(--deliverable-border) / 0.3)" : "none",
        }}
      />
      
      <div className="w-40 flex-shrink-0 flex items-start pt-2 pl-3 z-10">
        {deliverable ? (
          <div className="font-medium text-sm text-foreground truncate" title={deliverable.name}>
            {deliverable.name}
          </div>
        ) : (
          <div className="font-medium text-sm text-muted-foreground italic">
            Ungrouped
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-1 pr-3">
        {columnData.map((column) => {
          const columnActions = actions
            .filter((a) => a.status === column.status)
            .sort((a, b) => a.kanbanOrder - b.kanbanOrder);
          
          return (
            <DroppableCell
              key={`${rowId}__${column.status}`}
              id={`cell__${rowId}__${column.status}`}
              status={column.status}
              items={columnActions}
              onActionClick={onActionClick}
              onActionEdit={onActionEdit}
              showDescription={showDescription}
            />
          );
        })}
      </div>
    </div>
  );
}

export function KanbanBoard({
  actions,
  deliverables = [],
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
    }));
  }, []);

  const groupedActions = useMemo(() => {
    const groups: { deliverable: Deliverable | null; actions: ActionWithProgress[] }[] = [];
    
    for (const del of deliverables) {
      const delActions = actions.filter((a) => a.deliverableId === del.id);
      if (delActions.length > 0) {
        groups.push({ deliverable: del, actions: delActions });
      }
    }
    
    const ungroupedActions = actions.filter((a) => !a.deliverableId);
    if (ungroupedActions.length > 0) {
      groups.push({ deliverable: null, actions: ungroupedActions });
    }
    
    if (groups.length === 0 && actions.length > 0) {
      groups.push({ deliverable: null, actions: actions });
    }
    
    return groups;
  }, [actions, deliverables]);

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

    if (overId.startsWith("cell__")) {
      const parts = overId.split("__");
      const newStatus = parts[2] as ActionStatusType;
      
      if (newStatus && draggedAction.status !== newStatus) {
        onStatusChange?.(draggedAction.id, newStatus);
      }
      return;
    }

    const overAction = actions.find((a) => a.id === overId);
    if (!overAction) return;

    if (draggedAction.status !== overAction.status) {
      onStatusChange?.(draggedAction.id, overAction.status);
    } else if (draggedAction.id !== overAction.id) {
      const group = groupedActions.find((g) => 
        g.actions.some((a) => a.id === draggedAction.id)
      );
      if (!group) return;

      const columnItems = group.actions
        .filter((a) => a.status === draggedAction.status)
        .sort((a, b) => a.kanbanOrder - b.kanbanOrder);

      const oldIndex = columnItems.findIndex((a) => a.id === draggedAction.id);
      const newIndex = columnItems.findIndex((a) => a.id === overAction.id);

      if (oldIndex !== newIndex && onReorder) {
        const reordered = arrayMove(columnItems, oldIndex, newIndex);
        reordered.forEach((item, index) => {
          if (item.kanbanOrder !== index + 1) {
            onReorder(item.id, index + 1);
          }
        });
      }
    }
  };

  const hasDeliverables = deliverables.length > 0 && actions.some((a) => a.deliverableId);

  if (!hasDeliverables) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4 min-w-max">
            {columnData.map((column) => {
              const columnActions = actions
                .filter((a) => a.status === column.status)
                .sort((a, b) => a.kanbanOrder - b.kanbanOrder);
              
              return (
                <div
                  key={column.status}
                  className="w-72 flex-shrink-0"
                  data-testid={`kanban-column-${column.status.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="sticky top-0 bg-background z-10 pb-3 border-b mb-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${column.color}`} />
                        <h3 className="font-semibold text-base uppercase tracking-wide">{column.label}</h3>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">{columnActions.length}</span>
                    </div>
                  </div>
                  <DroppableCell
                    id={`cell__ungrouped__${column.status}`}
                    status={column.status}
                    items={columnActions}
                    onActionClick={onActionClick}
                    onActionEdit={onActionEdit}
                    showDescription={showDescription}
                  />
                </div>
              );
            })}
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="min-w-max">
          <div className="flex gap-4 pb-3 border-b mb-3 pl-44">
            {columnData.map((column) => {
              const columnCount = actions.filter((a) => a.status === column.status).length;
              return (
                <div key={column.status} className="w-72 flex-shrink-0">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${column.color}`} />
                      <h3 className="font-semibold text-base uppercase tracking-wide">{column.label}</h3>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{columnCount}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            {groupedActions.map((group, index) => (
              <DeliverableRow
                key={group.deliverable?.id || `ungrouped-${index}`}
                deliverable={group.deliverable}
                actions={group.actions}
                columnData={columnData}
                onActionClick={onActionClick}
                onActionEdit={onActionEdit}
                showDescription={showDescription}
              />
            ))}
          </div>
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
