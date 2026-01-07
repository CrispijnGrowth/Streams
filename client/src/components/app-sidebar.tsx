import { Link, useLocation } from "wouter";
import { Layers, LayoutGrid, Home, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme-provider";
import logoWhite from "@assets/Streams_Logo_White_1767805031570.png";
import logoBlack from "@assets/Streams_Logo_Black_1767805053205.png";

const menuItems = [
  {
    title: "Streams",
    url: "/",
    icon: Layers,
  },
  {
    title: "Global Kanban",
    url: "/kanban",
    icon: LayoutGrid,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { resolvedTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center" data-testid="link-home">
          <img 
            src={resolvedTheme === "dark" ? logoWhite : logoBlack} 
            alt="Streams" 
            className="h-8 w-auto"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-nav-${item.title.toLowerCase().replace(" ", "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground">
          v1.14 MVP
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
