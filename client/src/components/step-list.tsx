import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Pencil } from "lucide-react";
import { format } from "date-fns";
import type { Step } from "@shared/schema";

interface StepListProps {
  steps: Step[];
  onToggle?: (stepId: string, isDone: boolean) => void;
  onEdit?: (step: Step) => void;
}

export function StepList({ steps, onToggle, onEdit }: StepListProps) {
  const sortedSteps = [...steps].sort((a, b) => a.ordinal - b.ordinal);

  if (steps.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No steps defined
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedSteps.map((step) => {
        const isOverdue =
          step.dueDate &&
          !step.isDone &&
          new Date(step.dueDate) < new Date();

        return (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${
              step.isDone ? "bg-muted/50" : "bg-card"
            }`}
            data-testid={`step-${step.id}`}
          >
            <Checkbox
              checked={step.isDone}
              onCheckedChange={(checked) => onToggle?.(step.id, checked as boolean)}
              className="mt-0.5"
              data-testid={`checkbox-step-${step.id}`}
            />
            <div className="flex-1 min-w-0 space-y-1">
              <div className={`text-sm ${step.isDone ? "line-through text-muted-foreground" : ""}`}>
                {step.name}
              </div>
              {step.note && (
                <p className="text-xs text-muted-foreground">{step.note}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {step.dueDate && (
                  <div className={`flex items-center gap-1 ${isOverdue ? "text-status-blocked" : ""}`}>
                    <Calendar className="h-3 w-3" />
                    <span className="font-mono">
                      {format(new Date(step.dueDate), "MMM d")}
                    </span>
                  </div>
                )}
                {step.owner && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{step.owner}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onEdit?.(step)}
                data-testid={`button-edit-step-${step.id}`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              {step.isDone && (
                <Badge variant="outline" className="bg-status-done/10 text-status-done border-status-done/30 text-xs">
                  Done
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
