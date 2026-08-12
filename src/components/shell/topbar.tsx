import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { IconSair } from "@/components/icons";
import { MobileNav } from "./mobile-nav";

interface TopbarProps {
  /// Título da página atual (resolvido no layout a partir do pathname).
  children: React.ReactNode;
}

export function Topbar({ children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <MobileNav />
      <h1 className="truncate font-heading text-sm font-semibold text-foreground">{children}</h1>
      <div className="ml-auto flex items-center gap-2">
        <form action="/api/auth/logout" method="post">
          <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sair">
            <HugeiconsIcon icon={IconSair} size={16} strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </form>
      </div>
    </header>
  );
}
