import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { DescriptionsToggle } from "@/components/descriptions-toggle";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { StreamsOverview } from "@/pages/streams-overview";
import { StreamView } from "@/pages/stream-view";
import { DeliverableView } from "@/pages/deliverable-view";
import { ActionView } from "@/pages/action-view";
import { GlobalKanban } from "@/pages/global-kanban";
import NotFound from "@/pages/not-found";
import type { Stream, Deliverable, Action } from "@shared/schema";

function useBreadcrumbs() {
  const [location, setLocation] = useLocation();
  const [, streamParams] = useRoute("/stream/:streamId");
  const [, deliverableParams] = useRoute("/stream/:streamId/deliverable/:deliverableId");
  const [, actionParams] = useRoute("/stream/:streamId/deliverable/:deliverableId/action/:actionId");

  const streamId = streamParams?.streamId || deliverableParams?.streamId || actionParams?.streamId;
  const deliverableId = deliverableParams?.deliverableId || actionParams?.deliverableId;
  const actionId = actionParams?.actionId;

  const { data: stream } = useQuery<Stream>({
    queryKey: ["/api/streams", streamId],
    enabled: !!streamId,
  });

  const { data: deliverable } = useQuery<Deliverable>({
    queryKey: ["/api/deliverables", deliverableId],
    enabled: !!deliverableId,
  });

  const { data: action } = useQuery<Action>({
    queryKey: ["/api/actions", actionId],
    enabled: !!actionId,
  });

  const items: { label: string; href?: string }[] = [];

  if (stream) {
    items.push({
      label: stream.name,
      href: actionId || deliverableId ? `/stream/${streamId}` : undefined,
    });
  }

  if (deliverable) {
    items.push({
      label: deliverable.name,
      href: actionId ? `/stream/${streamId}/deliverable/${deliverableId}` : undefined,
    });
  }

  if (action) {
    items.push({ label: action.name });
  }

  const handleUpLevel = useCallback(() => {
    if (actionId && deliverableId && streamId) {
      setLocation(`/stream/${streamId}/deliverable/${deliverableId}`);
    } else if (deliverableId && streamId) {
      setLocation(`/stream/${streamId}`);
    } else if (streamId) {
      setLocation("/");
    }
  }, [actionId, deliverableId, streamId, setLocation]);

  return { items, onUpLevel: items.length > 1 ? handleUpLevel : undefined };
}

function Router({ showDescriptions }: { showDescriptions: boolean }) {
  return (
    <Switch>
      <Route path="/">
        <StreamsOverview showDescriptions={showDescriptions} />
      </Route>
      <Route path="/kanban">
        <GlobalKanban showDescriptions={showDescriptions} />
      </Route>
      <Route path="/stream/:streamId">
        {(params) => (
          <StreamView streamId={params.streamId} showDescriptions={showDescriptions} />
        )}
      </Route>
      <Route path="/stream/:streamId/deliverable/:deliverableId">
        {(params) => (
          <DeliverableView
            streamId={params.streamId}
            deliverableId={params.deliverableId}
            showDescriptions={showDescriptions}
          />
        )}
      </Route>
      <Route path="/stream/:streamId/deliverable/:deliverableId/action/:actionId">
        {(params) => (
          <ActionView
            streamId={params.streamId}
            deliverableId={params.deliverableId}
            actionId={params.actionId}
          />
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [showDescriptions, setShowDescriptions] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("streams-show-descriptions") !== "false";
    }
    return true;
  });

  const { items, onUpLevel } = useBreadcrumbs();

  const handleToggleDescriptions = useCallback(() => {
    setShowDescriptions((prev) => {
      const newValue = !prev;
      localStorage.setItem("streams-show-descriptions", String(newValue));
      return newValue;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
          e.preventDefault();
          handleToggleDescriptions();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleDescriptions]);

  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-2 border-b bg-background sticky top-0 z-50">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <BreadcrumbNav items={items} onUpLevel={onUpLevel} />
            </div>
            <div className="flex items-center gap-1">
              <DescriptionsToggle
                showDescriptions={showDescriptions}
                onToggle={handleToggleDescriptions}
              />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router showDescriptions={showDescriptions} />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
