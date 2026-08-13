"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconExpandir, IconMarca, IconRecolher } from "@/components/icons";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";
import { useSidebar } from "./sidebar-context";

/// Sidebar fixa à esquerda no desktop. No mobile ela não é renderizada:
/// a navegação mobile vive em <MobileNav /> (Sheet), montada pelo topbar.
export function AppSidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        // Altura em svh no lugar da medida antiga de tela cheia: no
        // computador dá exatamente o mesmo, e em tela de toque passa a valer
        // a área realmente visível.
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <Link
        href="/dashboard"
        prefetch
        className={cn(
          "flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <HugeiconsIcon icon={IconMarca} size={15} strokeWidth={2.2} aria-hidden="true" />
        </div>
        {!collapsed && (
          <span className="truncate font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
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
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn("w-full text-muted-foreground", collapsed && "justify-center px-0")}
        >
          <HugeiconsIcon
            icon={collapsed ? IconExpandir : IconRecolher}
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          {!collapsed && "Recolher"}
        </Button>
      </div>
    </aside>
  );
}
