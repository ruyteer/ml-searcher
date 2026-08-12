"use client";

import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";
import { useSidebar } from "./sidebar-context";

/// Navegação equivalente à sidebar, em formato Sheet, para telas pequenas.
export function MobileNav() {
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Abrir menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-4" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="flex-row items-center gap-2 border-b border-border p-4">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Search className="size-3.5" />
            </div>
            <SheetTitle>ML Searcher</SheetTitle>
            <SheetDescription className="sr-only">Menu de navegação</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-2.5">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={() => setMobileOpen(false)} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
