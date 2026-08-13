"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { IconMarca, IconSair } from "@/components/icons";
import { NAV_SECUNDARIOS } from "./nav-items";
import { NavLink } from "./nav-link";
import { useSidebar } from "./sidebar-context";

/**
 * Folha do botão "Mais" da barra inferior (só celular).
 *
 * Guarda o que não coube na barra: pre-sells, frases, WhatsApp,
 * configurações e a saída da conta. Sobe pelo rodapé, que é de onde veio o
 * toque, e respeita a faixa de gesto do aparelho.
 *
 * O gatilho não mora aqui: quem abre é <BottomNav />, pelo contexto.
 */
export function MobileNav() {
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side="bottom"
        // O recuo de baixo usa a mesma medida com piso e teto da barra de
        // navegação: o último item fica acima da faixa de gesto sem abrir
        // aquele espaço morto que o valor cru da área segura deixava.
        className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl bg-sidebar pb-[calc(0.75rem+var(--recuo-barra-inferior))] md:hidden"
      >
        <SheetHeader className="flex-row items-center gap-2.5 pb-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={IconMarca} size={15} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <SheetTitle>ML Searcher</SheetTitle>
          <SheetDescription className="sr-only">Mais destinos e sair da conta</SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-2.5" aria-label="Mais destinos">
          {NAV_SECUNDARIOS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              onNavigate={() => setMobileOpen(false)}
              className="min-h-12 text-[0.9375rem]"
            />
          ))}
        </nav>

        <Separator className="my-3" />

        <div className="px-2.5">
          <form action="/api/auth/logout" method="post">
            <Button
              type="submit"
              variant="ghost"
              className="min-h-12 w-full justify-start gap-3 pl-3 text-[0.9375rem] text-muted-foreground"
            >
              <HugeiconsIcon icon={IconSair} size={20} strokeWidth={1.6} aria-hidden="true" />
              Sair da conta
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
