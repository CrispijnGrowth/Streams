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
import { ActionStatus, type ActionWithProgress, type ActionStatusType, type Deliverable, DeliverableBorderColor, type DeliverableBorderColorType } from "@shared/schema";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMode } from "@/lib/mode-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Plus, GripVertical } from "lucide-react";

const borderColorMap: Record<DeliverableBorderColorType, string> = {
  cyan: "var(--deliverable-cyan)",
  magenta: "var(--deliverable-magenta)",
  yellow: "var(--deliverable-yellow)",
  lime: "var(--deliverable-lime)",
  orange: "var(--deliverable-orange)",
  pink: "var(--deliverable-pink)",
  blue: "var(--deliverable-blue)",
  green: "var(--deliverable-green)",
};

interface KanbanBoardProps {
  actions: ActionWithProgress[];
  deliverables?: Deliverable[];
  onActionClick?: (id: string) => void;
  onActionEdit?: (action: ActionWithProgress) => void;
  onStatusChange?: (actionId: string, newStatus: ActionStatusType) => void;
  onDeliverableChange?: (actionId: string, newDeliverableId: string | null) => void;
  onReorder?: (actionId: string, newKanbanOrder: number) => void;
  onDeliverableReorder?: (deliverableId: string, newOrdinal: number) => void;
  onAddAction?: (status: ActionStatusType, deliverableId?: string) => void;
  onAddDeliverable?: (name: string, borderColor: DeliverableBorderColorType) => void;
  onEditDeliverable?: (deliverable: Deliverable) => void;
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
  columnIndex?: number;
  onActionClick?: (id: string) => void;
  onActionEdit?: (action: ActionWithProgress) => void;
  onAddAction?: () => void;
  showDescription?: boolean;
  isEditMode?: boolean;
}

function DroppableCell({
  id,
  status,
  items,
  columnIndex = 0,
  onActionClick,
  onActionEdit,
  onAddAction,
  showDescription,
  isEditMode = false,
}: DroppableCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={`w-72 flex-shrink-0 space-y-2 min-h-[60px] p-2 transition-colors ${
          isOver ? "ring-2 ring-primary/30 rounded-lg" : ""
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
              onEdit={isEditMode ? () => onActionEdit?.(action) : undefined}
              showDescription={showDescription}
            />
          ))
        )}
        {isEditMode && onAddAction && (
          <div
            className="bg-card border border-dashed border-border/50 rounded-lg p-3 cursor-pointer hover-elevate active-elevate-2 flex items-center gap-2 text-muted-foreground"
            onClick={onAddAction}
            data-testid={`button-add-action-${status.toLowerCase().replace(/\s/g, "-")}`}
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Action</span>
          </div>
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
  onAddAction?: (status: ActionStatusType, deliverableId?: string) => void;
  onEditDeliverable?: (deliverable: Deliverable) => void;
  showDescription?: boolean;
  isEditMode?: boolean;
  isDragging?: boolean;
  dragHandleProps?: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
  };
}

function DeliverableRow({
  deliverable,
  actions,
  columnData,
  onActionClick,
  onActionEdit,
  onAddAction,
  onEditDeliverable,
  showDescription,
  isEditMode = false,
  isDragging = false,
  dragHandleProps,
}: DeliverableRowProps) {
  const rowId = deliverable?.id || "ungrouped";
  const borderColor = deliverable?.borderColor 
    ? `hsl(${borderColorMap[deliverable.borderColor]})`
    : "hsl(var(--deliverable-border))";
  
  return (
    <div 
      className={`relative flex gap-4 py-3 ${isDragging ? "opacity-50" : ""}`}
      data-testid={`deliverable-row-${rowId}`}
    >
      <div 
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          border: deliverable ? "2px solid" : "none",
          borderColor: deliverable ? borderColor : "transparent",
          boxShadow: deliverable ? `0 0 8px ${borderColor.replace(")", " / 0.3)")}` : "none",
        }}
      />
      
      <div className="w-40 flex-shrink-0 flex items-start pt-2 pl-1 z-10 gap-1">
        {deliverable && dragHandleProps && (
          <div 
            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        {deliverable ? (
          <div 
            className={`font-medium text-sm text-foreground truncate flex-1 ${isEditMode ? "cursor-pointer hover:underline" : ""}`}
            title={deliverable.name}
            onClick={isEditMode && onEditDeliverable ? () => onEditDeliverable(deliverable) : undefined}
          >
            {deliverable.name}
          </div>
        ) : (
          <div className="font-medium text-sm text-muted-foreground italic pl-5">
            Ungrouped
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-1 pr-3">
        {columnData.map((column, columnIndex) => {
          const columnActions = actions
            .filter((a) => a.status === column.status)
            .sort((a, b) => a.kanbanOrder - b.kanbanOrder);
          
          return (
            <DroppableCell
              key={`${rowId}__${column.status}`}
              id={`cell__${rowId}__${column.status}`}
              status={column.status}
              items={columnActions}
              columnIndex={columnIndex}
              onActionClick={onActionClick}
              onActionEdit={onActionEdit}
              onAddAction={onAddAction ? () => onAddAction(column.status, deliverable?.id) : undefined}
              showDescription={showDescription}
              isEditMode={isEditMode}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SortableDeliverableRowProps extends DeliverableRowProps {
  id: string;
}

function SortableDeliverableRow({ id, ...props }: SortableDeliverableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "deliverable" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DeliverableRow 
        {...props} 
        isDragging={isDragging}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}

export function KanbanBoard({
  actions,
  deliverables = [],
  onActionClick,
  onActionEdit,
  onStatusChange,
  onDeliverableChange,
  onReorder,
  onDeliverableReorder,
  onAddAction,
  onAddDeliverable,
  onEditDeliverable,
  showDescription = true,
}: KanbanBoardProps) {
  const { isEditMode } = useMode();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDeliverableId, setActiveDeliverableId] = useState<string | null>(null);
  const [newDeliverableName, setNewDeliverableName] = useState("");
  const [newDeliverableColor, setNewDeliverableColor] = useState<DeliverableBorderColorType>("cyan");
  const [addDeliverableOpen, setAddDeliverableOpen] = useState(false);

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

  const sortedDeliverables = useMemo(() => {
    return [...deliverables].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  }, [deliverables]);

  const deliverableIds = useMemo(() => {
    return sortedDeliverables.map((d) => d.id);
  }, [sortedDeliverables]);

  const groupedActions = useMemo(() => {
    const groups: { deliverable: Deliverable | null; actions: ActionWithProgress[] }[] = [];
    
    for (const del of sortedDeliverables) {
      const delActions = actions.filter((a) => a.deliverableId === del.id);
      groups.push({ deliverable: del, actions: delActions });
    }
    
    const ungroupedActions = actions.filter((a) => !a.deliverableId);
    if (ungroupedActions.length > 0) {
      groups.push({ deliverable: null, actions: ungroupedActions });
    }
    
    return groups;
  }, [actions, sortedDeliverables]);

  const activeAction = useMemo(() => {
    if (!activeId) return null;
    return actions.find((a) => a.id === activeId) || null;
  }, [activeId, actions]);

  const activeDeliverable = useMemo(() => {
    if (!activeDeliverableId) return null;
    return deliverables.find((d) => d.id === activeDeliverableId) || null;
  }, [activeDeliverableId, deliverables]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dragType = active.data?.current?.type;
    
    if (dragType === "deliverable") {
      setActiveDeliverableId(active.id as string);
    } else {
      setActiveId(active.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const dragType = active.data?.current?.type;
    
    setActiveId(null);
    setActiveDeliverableId(null);

    if (!over) return;

    if (dragType === "deliverable") {
      const draggedDeliverable = deliverables.find((d) => d.id === active.id);
      const overDeliverable = deliverables.find((d) => d.id === over.id);
      
      if (draggedDeliverable && overDeliverable && draggedDeliverable.id !== overDeliverable.id && onDeliverableReorder) {
        const oldIndex = sortedDeliverables.findIndex((d) => d.id === draggedDeliverable.id);
        const newIndex = sortedDeliverables.findIndex((d) => d.id === overDeliverable.id);
        
        if (oldIndex !== newIndex) {
          const newOrdinal = newIndex + 1;
          onDeliverableReorder(draggedDeliverable.id, newOrdinal);
        }
      }
      return;
    }

    const draggedAction = actions.find((a) => a.id === active.id);
    if (!draggedAction) return;

    const overId = over.id as string;

    if (overId.startsWith("cell__")) {
      const parts = overId.split("__");
      const rowId = parts[1];
      const newStatus = parts[2] as ActionStatusType;
      
      if (newStatus && draggedAction.status !== newStatus) {
        onStatusChange?.(draggedAction.id, newStatus);
      }
      
      const newDeliverableId = rowId === "ungrouped" ? null : rowId;
      if (draggedAction.deliverableId !== newDeliverableId) {
        onDeliverableChange?.(draggedAction.id, newDeliverableId);
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
            {columnData.map((column, columnIndex) => {
              const columnActions = actions
                .filter((a) => a.status === column.status)
                .sort((a, b) => a.kanbanOrder - b.kanbanOrder);
              const bgColor = columnIndex % 2 === 0 ? "bg-[hsl(var(--kanban-column-a))]" : "bg-[hsl(var(--kanban-column-b))]";
              
              return (
                <div
                  key={column.status}
                  className={`w-72 flex-shrink-0 rounded-lg ${bgColor}`}
                  data-testid={`kanban-column-${column.status.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="sticky top-0 z-10 pb-3 border-b mb-3 pt-2 px-2">
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
                    columnIndex={columnIndex}
                    onActionClick={onActionClick}
                    onActionEdit={onActionEdit}
                    onAddAction={onAddAction ? () => onAddAction(column.status) : undefined}
                    showDescription={showDescription}
                    isEditMode={isEditMode}
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
        <div className="min-w-max relative">
          <div className="absolute top-0 bottom-0 left-44 right-0 flex gap-4 pointer-events-none" style={{ zIndex: 0 }}>
            {columnData.map((column, columnIndex) => {
              const bgColor = columnIndex % 2 === 0 ? "bg-[hsl(var(--kanban-column-a))]" : "bg-[hsl(var(--kanban-column-b))]";
              return (
                <div key={`bg-${column.status}`} className={`w-72 flex-shrink-0 ${bgColor}`} />
              );
            })}
          </div>

          <div className="flex gap-4 pb-3 border-b mb-3 pl-44 relative" style={{ zIndex: 1 }}>
            {columnData.map((column, columnIndex) => {
              const columnCount = actions.filter((a) => a.status === column.status).length;
              return (
                <div key={column.status} className="w-72 flex-shrink-0 pt-2 px-2">
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

          <SortableContext items={deliverableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 relative" style={{ zIndex: 1 }}>
              {groupedActions.map((group, index) => {
                if (group.deliverable) {
                  return (
                    <SortableDeliverableRow
                      key={group.deliverable.id}
                      id={group.deliverable.id}
                      deliverable={group.deliverable}
                      actions={group.actions}
                      columnData={columnData}
                      onActionClick={onActionClick}
                      onActionEdit={onActionEdit}
                      onAddAction={onAddAction}
                      onEditDeliverable={onEditDeliverable}
                      showDescription={showDescription}
                      isEditMode={isEditMode}
                    />
                  );
                }
                return (
                  <DeliverableRow
                    key={`ungrouped-${index}`}
                    deliverable={null}
                    actions={group.actions}
                    columnData={columnData}
                    onActionClick={onActionClick}
                    onActionEdit={onActionEdit}
                    onAddAction={onAddAction}
                    onEditDeliverable={onEditDeliverable}
                    showDescription={showDescription}
                    isEditMode={isEditMode}
                  />
                );
              })}
            
            {isEditMode && onAddDeliverable && (
              <div className="flex gap-4 py-3 pl-3">
                <div className="w-40 flex-shrink-0">
                  <Popover open={addDeliverableOpen} onOpenChange={setAddDeliverableOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-muted-foreground"
                        data-testid="button-add-deliverable"
                      >
                        <Plus className="h-4 w-4" />
                        Add Deliverable
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="deliverable-name">Name</Label>
                          <Input
                            id="deliverable-name"
                            value={newDeliverableName}
                            onChange={(e) => setNewDeliverableName(e.target.value)}
                            placeholder="Enter deliverable name"
                            data-testid="input-new-deliverable-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Border Color</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {Object.entries(DeliverableBorderColor).map(([key, value]) => (
                              <button
                                key={value}
                                type="button"
                                className={`w-8 h-8 rounded-md border-2 transition-all ${
                                  newDeliverableColor === value ? "ring-2 ring-offset-2 ring-primary" : ""
                                }`}
                                style={{ backgroundColor: `hsl(${borderColorMap[value]})` }}
                                onClick={() => setNewDeliverableColor(value)}
                                data-testid={`button-color-${value}`}
                              />
                            ))}
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            if (newDeliverableName.trim()) {
                              onAddDeliverable(newDeliverableName.trim(), newDeliverableColor);
                              setNewDeliverableName("");
                              setNewDeliverableColor("cyan");
                              setAddDeliverableOpen(false);
                            }
                          }}
                          disabled={!newDeliverableName.trim()}
                          className="w-full"
                          data-testid="button-create-deliverable"
                        >
                          Create Deliverable
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
            </div>
          </SortableContext>
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
