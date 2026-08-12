"use client";

import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";
import { useSidebar } from "./sidebar-context";

/// Sidebar fixa à esquerda no desktop. No mobile ela não é renderizada —
/// a navegação mobile vive em <MobileNav /> (Sheet), montada pelo topbar.
export function AppSidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <Link
        href="/dashboard"
        prefetch
        className={cn(
          "flex h-14 items-center gap-2 border-b border-sidebar-border px-4",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Search className="size-3.5" />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            ML Searcher
          </span>
        )}
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
        <TooltipProvider>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </TooltipProvider>
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className={cn("w-full text-muted-foreground", collapsed && "justify-center px-0")}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && "Recolher"}
        </Button>
      </div>
    </aside>
  );
}
