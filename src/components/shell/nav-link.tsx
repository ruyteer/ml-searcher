"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavItem } from "./nav-items";
import { LinkPendingSignal } from "./link-pending-signal";

interface NavLinkProps {
  item: NavItem;
  /// Sidebar recolhida: mostra só o ícone, com o rótulo em tooltip.
  collapsed?: boolean;
  /// Fecha a Sheet mobile ao navegar.
  onNavigate?: () => void;
}

export function NavLink({ item, collapsed, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0 opacity-90 group-hover:opacity-100" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.comingSoon && (
            <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
              em breve
            </Badge>
          )}
        </>
      )}
      <LinkPendingSignal />
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
