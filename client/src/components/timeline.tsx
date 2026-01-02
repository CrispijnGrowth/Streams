import { useMemo, useState, useRef, useEffect } from "react";
import { TimelineBall } from "./timeline-ball";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, CalendarDays } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays, isWithinInterval, startOfYear, endOfYear, addQuarters, addYears } from "date-fns";
import type { ActionStatusType, MomentumStatusType } from "@shared/schema";

type ZoomLevel = "month" | "quarter" | "half-year" | "year";

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
}

interface TimelineProps {
  items: TimelineItem[];
  defaultWindowMonths?: number;
  onItemClick?: (id: string) => void;
  showNoDateShelf?: boolean;
  level?: "stream" | "deliverable" | "action";
}

const zoomLevelMonths: Record<ZoomLevel, number> = {
  month: 1,
  quarter: 3,
  "half-year": 6,
  year: 12,
};

export function Timeline({
  items,
  defaultWindowMonths = 12,
  onItemClick,
  showNoDateShelf = true,
  level = "stream",
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("year");
  const today = useMemo(() => new Date(), []);

  const defaultStart = useMemo(() => {
    if (level === "action") {
      return addMonths(today, -3);
    }
    return startOfYear(today);
  }, [today, level]);

  const defaultEnd = useMemo(() => {
    if (level === "action") {
      return addMonths(today, 3);
    }
    return endOfYear(today);
  }, [today, level]);

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
    setZoom("year");
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

  const getPositionForDate = (dateStr: string): number => {
    const date = new Date(dateStr);
    const daysFromStart = differenceInDays(date, viewStart);
    return (daysFromStart / totalDays) * 100;
  };

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
  }, [today, viewStart, viewEnd]);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Timeline
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
          className="flex-1 relative h-24 bg-card rounded-lg border overflow-hidden"
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
            {visibleItems.map((item) => {
              const position = getPositionForDate(item.date!);
              return (
                <div
                  key={item.id}
                  className="absolute"
                  style={{
                    left: `${position}%`,
                    transform: "translateX(-50%)",
                  }}
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
                    onClick={() => onItemClick?.(item.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {showNoDateShelf && undatedItems.length > 0 && (
          <div className="w-20 ml-2 bg-card rounded-lg border p-2 flex flex-col items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              No date
            </span>
            <div className="flex flex-wrap gap-1 justify-center">
              {undatedItems.slice(0, 4).map((item) => (
                <TimelineBall
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.description}
                  status={item.status}
                  momentumStatus={item.momentumStatus}
                  progress={item.progress}
                  counts={item.counts}
                  isNoDate
                  size="sm"
                  onClick={() => onItemClick?.(item.id)}
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
  );
}
