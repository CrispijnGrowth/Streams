import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  DragMoveEvent,
} from "@dnd-kit/core";
import { TimelineBall } from "./timeline-ball";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { format, addMonths, startOfMonth, differenceInDays, isWithinInterval, addDays } from "date-fns";
import type { ActionStatusType, MomentumStatusType } from "@shared/schema";
import { usePageTransition } from "./page-transition";

type ZoomLevel = "month" | "quarter" | "half-year" | "year";

type TimelineItemType = "stream" | "solution" | "deliverable" | "action";

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date?: string;
  status?: ActionStatusType;
  momentumStatus?: MomentumStatusType;
  progress?: number;
  counts?: {
    doing?: number;
    blocked?: number;
    delegated?: number;
  };
  type?: TimelineItemType;
  parentId?: string;
  parentName?: string;
  borderColor?: string;
  drivingSolutionName?: string;
  isOnHold?: boolean;
}

interface TimelineProps {
  items: TimelineItem[];
  defaultWindowMonths?: number;
  onItemClick?: (id: string) => void;
  onDateChange?: (id: string, newDate: string) => void;
  showNoDateShelf?: boolean;
  level?: "stream" | "solution" | "action";
}

const zoomLevelMonths: Record<ZoomLevel, number> = {
  month: 1,
  quarter: 3,
  "half-year": 6,
  year: 12,
};

interface DraggableTimelineBallProps {
  item: TimelineItem;
  position: number;
  onClick?: () => void;
  isDraggable?: boolean;
  enterAnimation?: {
    active: boolean;
    delayMs: number;
  };
  stackIndex?: number;
  stackTotal?: number;
}

function DraggableTimelineBall({ item, position, onClick, isDraggable = true, enterAnimation, stackIndex = 0, stackTotal = 1 }: DraggableTimelineBallProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !isDraggable,
    data: { item },
  });

  const verticalOffset = stackTotal > 1 ? (stackIndex - (stackTotal - 1) / 2) * 8 : 0;
  const baseZIndex = stackTotal - stackIndex;

  return (
    <div
      ref={setNodeRef}
      className="absolute transition-all duration-200"
      style={{
        left: `${position}%`,
        transform: `translateX(-50%) translateY(${verticalOffset}px) scale(${isHovered ? 1.08 : 1})`,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDraggable ? "grab" : "pointer",
        zIndex: isHovered ? 100 : baseZIndex,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      <TimelineBall
        id={item.id}
        title={item.title}
        description={item.description}
        date={item.date}
        status={item.status}
        momentumStatus={item.momentumStatus}
        progress={item.progress}
        counts={item.counts}
        onClick={isDragging ? undefined : onClick}
        enterAnimation={isDragging ? undefined : enterAnimation}
        shape={item.type === "action" ? "diamond" : "circle"}
        borderColor={item.borderColor}
        itemType={item.type}
        parentName={item.parentName}
        drivingSolutionName={item.drivingSolutionName}
        isOnHold={item.isOnHold}
      />
    </div>
  );
}

interface DraggableUndatedBallProps {
  item: TimelineItem;
  isDraggable?: boolean;
  onClick?: () => void;
  enterAnimation?: { active: boolean; delayMs: number };
}

function DraggableUndatedBall({ item, isDraggable = true, onClick, enterAnimation }: DraggableUndatedBallProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `undated-${item.id}`,
    disabled: !isDraggable,
    data: { item, isUndated: true },
  });

  return (
    <div
      ref={setNodeRef}
      className="transition-all duration-200"
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDraggable ? "grab" : "pointer",
        transform: `scale(${isHovered ? 1.08 : 1})`,
        zIndex: isHovered ? 100 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      <TimelineBall
        id={item.id}
        title={item.title}
        description={item.description}
        status={item.status}
        momentumStatus={item.momentumStatus}
        progress={item.progress}
        counts={item.counts}
        isNoDate
        isOnHold={item.isOnHold}
        size="sm"
        onClick={isDragging ? undefined : onClick}
        enterAnimation={isDragging ? undefined : enterAnimation}
        shape={item.type === "action" ? "diamond" : "circle"}
        borderColor={item.borderColor}
        itemType={item.type}
        parentName={item.parentName}
        drivingSolutionName={item.drivingSolutionName}
      />
    </div>
  );
}

export function Timeline({
  items,
  defaultWindowMonths = 12,
  onItemClick,
  onDateChange,
  showNoDateShelf = true,
  level = "stream",
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("half-year");
  const today = useMemo(() => new Date(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragPreviewDate, setDragPreviewDate] = useState<string | null>(null);
  const { animationKey } = usePageTransition();
  const [animateIn, setAnimateIn] = useState(true);
  const lastAnimationKey = useRef(animationKey);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const timer = setTimeout(() => {
        setAnimateIn(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (animationKey !== lastAnimationKey.current) {
      lastAnimationKey.current = animationKey;
      setAnimateIn(true);
      const timer = setTimeout(() => {
        setAnimateIn(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [animationKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const defaultStart = useMemo(() => {
    return addDays(today, -7);
  }, [today]);

  const defaultEnd = useMemo(() => {
    return addMonths(defaultStart, 6);
  }, [defaultStart]);

  const [viewStart, setViewStart] = useState(defaultStart);
  const [viewEnd, setViewEnd] = useState(defaultEnd);

  const handleZoomIn = () => {
    const zoomOrder: ZoomLevel[] = ["year", "half-year", "quarter", "month"];
    const currentIndex = zoomOrder.indexOf(zoom);
    if (currentIndex < zoomOrder.length - 1) {
      const newZoom = zoomOrder[currentIndex + 1];
      setZoom(newZoom);
      const months = zoomLevelMonths[newZoom];
      const midpoint = new Date((viewStart.getTime() + viewEnd.getTime()) / 2);
      setViewStart(addMonths(midpoint, -Math.floor(months / 2)));
      setViewEnd(addMonths(midpoint, Math.ceil(months / 2)));
    }
  };

  const handleZoomOut = () => {
    const zoomOrder: ZoomLevel[] = ["year", "half-year", "quarter", "month"];
    const currentIndex = zoomOrder.indexOf(zoom);
    if (currentIndex > 0) {
      const newZoom = zoomOrder[currentIndex - 1];
      setZoom(newZoom);
      const months = zoomLevelMonths[newZoom];
      const midpoint = new Date((viewStart.getTime() + viewEnd.getTime()) / 2);
      setViewStart(addMonths(midpoint, -Math.floor(months / 2)));
      setViewEnd(addMonths(midpoint, Math.ceil(months / 2)));
    }
  };

  const handleReset = () => {
    setZoom("half-year");
    setViewStart(defaultStart);
    setViewEnd(defaultEnd);
  };

  const datedItems = useMemo(() => {
    return items.filter((item) => item.date);
  }, [items]);

  const undatedItems = useMemo(() => {
    return items.filter((item) => !item.date);
  }, [items]);

  const visibleItems = useMemo(() => {
    return datedItems.filter((item) => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      return isWithinInterval(itemDate, { start: viewStart, end: viewEnd });
    });
  }, [datedItems, viewStart, viewEnd]);

  const totalDays = differenceInDays(viewEnd, viewStart);

  const getPositionForDate = useCallback((dateStr: string): number => {
    const date = new Date(dateStr);
    const daysFromStart = differenceInDays(date, viewStart);
    return (daysFromStart / totalDays) * 100;
  }, [viewStart, totalDays]);

  const getDateForPosition = useCallback((positionPercent: number): Date => {
    const daysFromStart = Math.round((positionPercent / 100) * totalDays);
    return addDays(viewStart, daysFromStart);
  }, [viewStart, totalDays]);

  const monthMarkers = useMemo(() => {
    const markers: { date: Date; label: string }[] = [];
    let current = startOfMonth(viewStart);
    while (current <= viewEnd) {
      if (current >= viewStart) {
        markers.push({
          date: current,
          label: format(current, zoom === "month" ? "d MMM" : "MMM yyyy"),
        });
      }
      current = addMonths(current, 1);
    }
    return markers;
  }, [viewStart, viewEnd, zoom]);

  const todayPosition = useMemo(() => {
    if (isWithinInterval(today, { start: viewStart, end: viewEnd })) {
      return getPositionForDate(today.toISOString());
    }
    return null;
  }, [today, viewStart, viewEnd, getPositionForDate]);

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    if (activeId.startsWith("undated-")) {
      const realId = activeId.replace("undated-", "");
      return items.find((i) => i.id === realId) || null;
    }
    return items.find((i) => i.id === activeId) || null;
  }, [activeId, items]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!containerRef.current || !activeId) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const activeData = event.active.data.current as { item: TimelineItem; isUndated?: boolean } | undefined;
    
    if (activeData?.isUndated) {
      const pointerX = (event.active.rect.current.translated?.left ?? 0) + 
                       (event.active.rect.current.translated?.width ?? 0) / 2;
      const relativeX = pointerX - containerRect.left;
      const positionPercent = Math.max(0, Math.min(100, (relativeX / containerRect.width) * 100));
      const newDate = getDateForPosition(positionPercent);
      setDragPreviewDate(format(newDate, "yyyy-MM-dd"));
    } else {
      const draggedItem = items.find((i) => i.id === activeId);
      if (draggedItem?.date) {
        const originalPosition = getPositionForDate(draggedItem.date);
        const deltaPercent = (event.delta.x / containerRect.width) * 100;
        const newPosition = Math.max(0, Math.min(100, originalPosition + deltaPercent));
        const newDate = getDateForPosition(newPosition);
        setDragPreviewDate(format(newDate, "yyyy-MM-dd"));
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    
    if (containerRef.current && onDateChange) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeData = active.data.current as { item: TimelineItem; isUndated?: boolean } | undefined;
      
      if (activeData?.isUndated) {
        const pointerX = (active.rect.current.translated?.left ?? 0) + 
                         (active.rect.current.translated?.width ?? 0) / 2;
        const relativeX = pointerX - containerRect.left;
        
        if (relativeX >= 0 && relativeX <= containerRect.width) {
          const positionPercent = (relativeX / containerRect.width) * 100;
          const newDate = getDateForPosition(positionPercent);
          const formattedDate = format(newDate, "yyyy-MM-dd");
          const itemId = activeData.item.id;
          onDateChange(itemId, formattedDate);
        }
      } else {
        const draggedItem = items.find((i) => i.id === active.id);
        if (draggedItem?.date) {
          const originalPosition = getPositionForDate(draggedItem.date);
          const deltaPercent = (delta.x / containerRect.width) * 100;
          const newPosition = Math.max(0, Math.min(100, originalPosition + deltaPercent));
          const newDate = getDateForPosition(newPosition);
          const formattedDate = format(newDate, "yyyy-MM-dd");
          
          if (formattedDate !== draggedItem.date) {
            onDateChange(active.id as string, formattedDate);
          }
        }
      }
    }
    
    setActiveId(null);
    setDragPreviewDate(null);
  };

  const isDraggable = !!onDateChange;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Timeline
            </div>
            {dragPreviewDate && (
              <div className="text-xs font-mono bg-primary text-primary-foreground px-2 py-0.5 rounded">
                {format(new Date(dragPreviewDate), "MMM d, yyyy")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomOut}
              disabled={zoom === "year"}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[60px] text-center capitalize">
              {zoom.replace("-", " ")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomIn}
              disabled={zoom === "month"}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleReset}
              data-testid="button-reset-timeline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="relative flex">
          <div
            ref={containerRef}
            className="flex-1 relative h-24 bg-card rounded-lg border overflow-visible"
          >
            <div className="absolute inset-0 flex">
              {monthMarkers.map((marker, i) => {
                const position = getPositionForDate(marker.date.toISOString());
                if (position < 0 || position > 100) return null;
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/50"
                    style={{ left: `${position}%` }}
                  >
                    <span className="absolute top-1 left-1 text-[10px] text-muted-foreground uppercase whitespace-nowrap">
                      {marker.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                style={{ left: `${todayPosition}%` }}
                data-testid="today-marker"
              >
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] px-1 py-0.5 rounded">
                  Today
                </div>
              </div>
            )}

            <div className="absolute inset-0 flex items-center">
              {(() => {
                const itemsWithPositions = visibleItems
                  .map((item) => ({
                    item,
                    position: getPositionForDate(item.date!),
                  }))
                  .sort((a, b) => a.position - b.position);

                const stackGroups: Map<string, number[]> = new Map();
                itemsWithPositions.forEach(({ position }, idx) => {
                  const key = position.toFixed(1);
                  if (!stackGroups.has(key)) {
                    stackGroups.set(key, []);
                  }
                  stackGroups.get(key)!.push(idx);
                });

                return itemsWithPositions.map(({ item, position }, index) => {
                  const key = position.toFixed(1);
                  const group = stackGroups.get(key) || [index];
                  const stackIndex = group.indexOf(index);
                  const stackTotal = group.length;

                  return (
                    <DraggableTimelineBall
                      key={item.id}
                      item={item}
                      position={position}
                      onClick={() => onItemClick?.(item.id)}
                      isDraggable={isDraggable}
                      enterAnimation={animateIn ? { active: true, delayMs: index * 50 } : undefined}
                      stackIndex={stackIndex}
                      stackTotal={stackTotal}
                    />
                  );
                });
              })()}
            </div>
          </div>

          {showNoDateShelf && undatedItems.length > 0 && (
            <div className="w-20 ml-2 bg-card rounded-lg border p-2 flex flex-col items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {isDraggable ? "Drag to set" : "No date"}
              </span>
              <div className="flex flex-wrap gap-1 justify-center">
                {undatedItems.slice(0, 4).map((item, index) => (
                  <DraggableUndatedBall
                    key={item.id}
                    item={item}
                    isDraggable={isDraggable}
                    onClick={() => onItemClick?.(item.id)}
                    enterAnimation={animateIn ? { active: true, delayMs: (visibleItems.length + index) * 50 } : undefined}
                  />
                ))}
                {undatedItems.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{undatedItems.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeItem && (
          <div style={{ cursor: "grabbing" }}>
            <TimelineBall
              id={activeItem.id}
              title={activeItem.title}
              description={activeItem.description}
              date={dragPreviewDate || activeItem.date}
              status={activeItem.status}
              momentumStatus={activeItem.momentumStatus}
              progress={activeItem.progress}
              counts={activeItem.counts}
              shape={activeItem.type === "action" ? "diamond" : "circle"}
              borderColor={activeItem.borderColor}
              itemType={activeItem.type}
              parentName={activeItem.parentName}
              drivingSolutionName={activeItem.drivingSolutionName}
              isOnHold={activeItem.isOnHold}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
