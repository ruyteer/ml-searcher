"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
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
  /// Ajustes pontuais de tamanho (a folha do celular usa alvo maior).
  className?: string;
}

/**
 * Item da navegação lateral.
 *
 * O estado ativo não pinta o fundo: ele coloca uma barra amarela sólida
 * encostada na borda esquerda do item e engrossa o rótulo. O hover usa
 * superfície neutra, sem cor. O foco por teclado usa anel amarelo. Cada
 * estado tem uma pista visual própria, então nenhum se confunde com o outro.
 * As regras de animação da barra e da troca de ícone vivem em globals.css
 * (.nav-item, .nav-item-indicator, .nav-item-icon).
 */
export function NavLink({ item, collapsed, onNavigate, className }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  const link = (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "nav-item flex items-center gap-3 rounded-md py-2 pr-2.5 pl-3 text-sm transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        collapsed && "justify-center pr-0 pl-0",
        isActive
          ? "font-semibold text-sidebar-foreground"
          : "font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
        className
      )}
    >
      <span className="nav-item-indicator" aria-hidden="true" />
      <span className="nav-item-icon size-5">
        <HugeiconsIcon
          icon={item.icon}
          size={20}
          strokeWidth={1.6}
          data-variant="base"
          aria-hidden="true"
        />
        <HugeiconsIcon
          icon={item.iconAlt}
          size={20}
          strokeWidth={2}
          data-variant="alt"
          aria-hidden="true"
        />
      </span>
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
