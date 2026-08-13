"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { IconMenu } from "@/components/icons";
import { NAV_PRINCIPAIS, NAV_SECUNDARIOS, type NavItem } from "./nav-items";
import { LinkPendingSignal } from "./link-pending-signal";
import { useSidebar } from "./sidebar-context";

/// Classe comum do botão e dos links da barra: alto o bastante para o dedo
/// (56px, acima do mínimo de 44px) e largura inteira da coluna.
const CELULA =
  "nav-item nav-item-inferior flex h-14 w-full flex-col items-center justify-center gap-1 px-1 text-[10px] transition-colors outline-none focus-visible:bg-accent";

function BottomNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      prefetch
      data-active={ativo}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        CELULA,
        ativo ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
      )}
    >
      <span className="nav-item-inferior-indicador" aria-hidden="true" />
      <span className="nav-item-icon size-6">
        <HugeiconsIcon
          icon={item.icon}
          size={22}
          strokeWidth={1.6}
          data-variant="base"
          aria-hidden="true"
        />
        <HugeiconsIcon
          icon={item.iconAlt}
          size={22}
          strokeWidth={2}
          data-variant="alt"
          aria-hidden="true"
        />
      </span>
      <span className="max-w-full truncate leading-none">{item.labelCurto ?? item.label}</span>
      <LinkPendingSignal />
    </Link>
  );
}

/**
 * Barra de navegação fixa no rodapé, só no celular.
 *
 * A ideia é uso de uma mão: os quatro destinos do dia a dia ficam na altura
 * do polegar, e o resto entra no botão "Mais". O item ativo mantém a mesma
 * linguagem da sidebar (traço amarelo e rótulo mais pesado), só que o traço
 * agora encosta na borda de cima, que é a que fica virada para o conteúdo.
 *
 * No desktop ela não existe: a sidebar continua sendo a navegação.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebar();

  // O "Mais" também acende quando a página aberta mora dentro dele.
  const maisAtivo = NAV_SECUNDARIOS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <nav
      aria-label="Navegação principal"
      // A barra encosta na borda de baixo e o fundo vai junto até lá. O que
      // sobe é só o conteúdo, pelo recuo com piso e teto de globals.css:
      // os ícones ficam fora da faixa de gesto sem deixar aquele vão.
      // Fundo sólido, sem vidro: translúcido com desfoque, o pedaço abaixo
      // dos ícones mostrava a página passando por trás e lia como espaço
      // vazio em vez de parte da barra.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pr-[var(--area-segura-dir)] pb-[var(--recuo-barra-inferior)] pl-[var(--area-segura-esq)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_PRINCIPAIS.map((item) => (
          <li key={item.href} className="min-w-0">
            <BottomNavLink item={item} />
          </li>
        ))}
        <li className="min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            data-active={maisAtivo}
            aria-haspopup="dialog"
            className={cn(
              CELULA,
              maisAtivo ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
            )}
          >
            <span className="nav-item-inferior-indicador" aria-hidden="true" />
            <span className="nav-item-icon size-6">
              <HugeiconsIcon icon={IconMenu} size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="leading-none">Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
