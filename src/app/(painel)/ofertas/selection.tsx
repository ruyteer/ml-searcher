"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { TickDouble02Icon, Loading03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OfferStatus } from "@/generated/prisma";
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

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <span className="font-medium">{selected.size} selecionada(s)</span>
      <Button variant="outline" size="xs" disabled={isPending} onClick={() => run(OfferStatus.PUBLISHED)}>
        {isPending ? (
          <HugeiconsIcon icon={Loading03Icon} size={13} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <HugeiconsIcon icon={TickDouble02Icon} size={13} strokeWidth={1.5} />
        )}
        Marcar publicadas
      </Button>
      <Button variant="outline" size="xs" disabled={isPending} onClick={() => run(OfferStatus.IGNORED)}>
        Ignorar
      </Button>
      <Button variant="ghost" size="xs" onClick={clear}>
        <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.5} /> Limpar
      </Button>
    </div>
  );
}
