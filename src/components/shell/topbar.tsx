import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { IconMarca, IconSair } from "@/components/icons";

interface TopbarProps {
  /// Título da página atual (resolvido no layout a partir do pathname).
  children: React.ReactNode;
}

/**
 * Barra do topo.
 *
 * No celular ela é só identidade e título: a navegação mudou para a barra
 * de baixo, e sair da conta ficou dentro do "Mais". Sobrou espaço, que é o
 * que interessa numa tela de 360px. O recuo de cima acompanha o recorte da
 * câmera, porque em app instalado o conteúdo começa colado no topo da tela.
 */
export function Topbar({ children }: TopbarProps) {
  return (
    // O recuo de cima vale zero no app instalado, porque agora quem reserva
    // a faixa do relógio é o sistema (ver appleWebApp em src/app/layout.tsx).
    // Ele continua aqui para o caso de o painel ser aberto pelo navegador com
    // a tela deitada, quando o recorte da câmera volta a invadir a página.
    <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-background/80 pt-[var(--area-segura-cima)] pr-[var(--area-segura-dir)] pl-[var(--area-segura-esq)] backdrop-blur-sm">
      <div className="flex h-12 items-center gap-2.5 px-3 md:h-14 md:px-4">
        <Link
          href="/dashboard"
          prefetch
          aria-label="Ir para a visão geral"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <HugeiconsIcon icon={IconMarca} size={15} strokeWidth={2.2} aria-hidden="true" />
        </Link>

        <h1 className="truncate font-heading text-sm font-semibold text-foreground">{children}</h1>

        {/* Sair no celular mora no botão "Mais" da barra de baixo. */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <form action="/api/auth/logout" method="post">
            <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sair">
              <HugeiconsIcon icon={IconSair} size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
