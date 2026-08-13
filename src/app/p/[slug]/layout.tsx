import type { ReactNode } from "react";

// Layout próprio da pre-sell pública: sem sidebar, sem nada do painel.
// Só um fundo limpo e alto contraste pro conteúdo centralizado.
export default function PresellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh w-full flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
