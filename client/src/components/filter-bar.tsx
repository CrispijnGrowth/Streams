import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, X } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  activeFilters,
  onFilterChange,
  onClearAll,
}: FilterBarProps) {
  const hasActiveFilters = useMemo(() => {
    return Object.values(activeFilters).some((values) => values.length > 0);
  }, [activeFilters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).reduce(
      (acc, values) => acc + values.length,
      0
    );
  }, [activeFilters]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {activeFilterCount}
          </Badge>
        )}
      </div>

      {filters.map((filter) => {
        const activeValues = activeFilters[filter.key] || [];
        return (
          <DropdownMenu key={filter.key}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={activeValues.length > 0 ? "secondary" : "outline"}
                size="sm"
                className="gap-1"
                data-testid={`filter-${filter.key}`}
              >
                {filter.label}
                {activeValues.length > 0 && (
                  <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
                    {activeValues.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {filter.options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={activeValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onFilterChange(filter.key, [...activeValues, option.value]);
                    } else {
                      onFilterChange(
                        filter.key,
                        activeValues.filter((v) => v !== option.value)
                      );
                    }
                  }}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="gap-1 text-muted-foreground"
          data-testid="button-clear-filters"
        >
          <X className="h-3 w-3" />
          Clear all
        </Button>
      )}
    </div>
  );
}
