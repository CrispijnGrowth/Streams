import { Link } from "wouter";
import { ChevronRight, Home, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  onUpLevel?: () => void;
}

export function BreadcrumbNav({ items, onUpLevel }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      <Link href="/" data-testid="breadcrumb-home">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Home className="h-4 w-4" />
          <span className="sr-only">Home</span>
        </Button>
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors px-1"
              data-testid={`breadcrumb-item-${index}`}
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium px-1" data-testid={`breadcrumb-current`}>
              {item.label}
            </span>
          )}
        </div>
      ))}
      {onUpLevel && items.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUpLevel}
          className="ml-2 h-7 gap-1"
          data-testid="button-up-level"
        >
          <ChevronUp className="h-3 w-3" />
          Up
        </Button>
      )}
    </nav>
  );
}
