"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { IconMarca, IconMenu } from "@/components/icons";
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
        <HugeiconsIcon icon={IconMenu} size={18} strokeWidth={1.8} aria-hidden="true" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetHeader className="flex-row items-center gap-2.5 border-b border-sidebar-border p-4">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HugeiconsIcon icon={IconMarca} size={15} strokeWidth={2.2} aria-hidden="true" />
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
