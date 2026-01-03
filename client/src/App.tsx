import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation, useRoute, Link, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { DescriptionsToggle } from "@/components/descriptions-toggle";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { GlobalSearch } from "@/components/global-search";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Layers, LayoutGrid, Trash2, Search, LogOut, Settings, Loader2 } from "lucide-react";
import { StreamsOverview } from "@/pages/streams-overview";
import { StreamView } from "@/pages/stream-view";
import { DeliverableView } from "@/pages/deliverable-view";
import { ActionView } from "@/pages/action-view";
import { GlobalKanban } from "@/pages/global-kanban";
import { RecycleBin } from "@/pages/recycle-bin";
import { LoginPage } from "@/pages/login";
import { AuthVerifyPage } from "@/pages/auth-verify";
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
      <Route path="/recycle-bin">
        <RecycleBin />
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

function TopNav() {
  const [location] = useLocation();

  return (
    <nav className="flex items-center gap-1">
      <Link href="/">
        <Button
          variant={location === "/" ? "secondary" : "ghost"}
          size="sm"
          className="gap-2"
          data-testid="nav-streams"
        >
          <Layers className="h-4 w-4" />
          <span>Streams</span>
        </Button>
      </Link>
      <Link href="/kanban">
        <Button
          variant={location === "/kanban" ? "secondary" : "ghost"}
          size="sm"
          className="gap-2"
          data-testid="nav-kanban"
        >
          <LayoutGrid className="h-4 w-4" />
          <span>Kanban</span>
        </Button>
      </Link>
      <Link href="/recycle-bin">
        <Button
          variant={location === "/recycle-bin" ? "secondary" : "ghost"}
          size="sm"
          className="gap-2"
          data-testid="nav-recycle-bin"
        >
          <Trash2 className="h-4 w-4" />
          <span>Recycle Bin</span>
        </Button>
      </Link>
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-settings">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppContent() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();
  const [showDescriptions, setShowDescriptions] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("streams-show-descriptions") !== "false";
    }
    return true;
  });
  const [searchOpen, setSearchOpen] = useState(false);

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
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "d" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditing) {
        e.preventDefault();
        handleToggleDescriptions();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !isEditing) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleDescriptions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/auth/verify" component={AuthVerifyPage} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-muted sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <TopNav />
          {items.length > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <BreadcrumbNav items={items} onUpLevel={onUpLevel} />
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setSearchOpen(true)}
            data-testid="button-search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline text-muted-foreground text-xs">Ctrl+K</span>
          </Button>
          <DescriptionsToggle
            showDescriptions={showDescriptions}
            onToggle={handleToggleDescriptions}
          />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <main className="flex-1 overflow-auto">
        <PageTransition transitionKey={location}>
          <Router showDescriptions={showDescriptions} />
        </PageTransition>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
