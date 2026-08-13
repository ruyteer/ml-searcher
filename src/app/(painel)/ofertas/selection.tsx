"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { TickDouble02Icon, Loading03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OfferStatus } from "@/lib/enums";
import { setOffersStatusBulk } from "@/app/(painel)/ofertas/actions";

interface SelectionContextValue {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/// Contexto de seleção múltipla dos cards de oferta. Fica no client, mas
/// envolve a grade renderizada no servidor (composição via `children`).
export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo(() => ({ selected, toggle, clear }), [selected, toggle, clear]);

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection precisa estar dentro de <SelectionProvider>");
  return ctx;
}

/// Barra de ações em massa — só aparece com seleção ativa.
export function BulkActionsBar() {
  const { selected, clear } = useSelection();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (selected.size === 0) return null;

  const run = (status: OfferStatus) => {
    const ids = [...selected];
    startTransition(async () => {
      try {
        await setOffersStatusBulk(ids, status);
        toast.success(`${ids.length} oferta(s) atualizada(s)`);
        clear();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível aplicar a ação em massa");
      }
    });
  };

  const contagem = `${selected.size} ${selected.size === 1 ? "oferta selecionada" : "ofertas selecionadas"}`;

  // Fica grudada logo abaixo da barra do topo (h-14) enquanto o usuário rola a
  // lista: no celular a seleção começa numa oferta e termina em outra, várias
  // telas depois, e uma barra que sai da tela é uma barra que não existe.
  return (
    <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <span className="font-medium">{contagem}</span>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-11 sm:h-7"
          disabled={isPending}
          onClick={() => run(OfferStatus.PUBLISHED)}
        >
          {isPending ? (
            <HugeiconsIcon icon={Loading03Icon} size={15} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <HugeiconsIcon icon={TickDouble02Icon} size={15} strokeWidth={1.5} />
          )}
          Marcar publicadas
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-11 sm:h-7"
          disabled={isPending}
          onClick={() => run(OfferStatus.IGNORED)}
        >
          Ignorar
        </Button>
        <Button variant="ghost" size="sm" className="h-11 sm:h-7" onClick={clear}>
          <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.5} /> Limpar
        </Button>
      </div>
    </div>
  );
}
