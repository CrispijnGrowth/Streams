import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function StreamCardSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </Card>
  );
}

export function SolutionCardSkeleton() {
  return (
    <Card className="p-3 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
      <Skeleton className="h-3 w-24" />
    </Card>
  );
}

export function ActionCardSkeleton() {
  return (
    <Card className="p-3 space-y-2">
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
    </Card>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="w-72 flex-shrink-0">
          <div className="flex items-center gap-2 p-2 mb-2">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-6 rounded-full ml-auto" />
          </div>
          <div className="space-y-3">
            {[1, 2].map((j) => (
              <ActionCardSkeleton key={j} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
