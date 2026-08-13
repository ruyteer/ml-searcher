"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconGrupos, IconAtualizar, IconCarregando, IconBuscar } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/produto/pagination";
import type { WhatsappGroupRow } from "@/lib/data/whatsapp";
import { syncGroupsAction, toggleGroupAction } from "./actions";

const PAGE_SIZE = 8;

export interface GroupsListProps {
  instanceId: string | null;
  connected: boolean;
  groups: WhatsappGroupRow[];
}

function GroupRow({ group }: { group: WhatsappGroupRow }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(group.enabled);
  const [, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleGroupAction(group.id, next);
      if (!res.ok) {
        setEnabled(!next);
        toast.error(res.message);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{group.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{group.remoteJid}</p>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} />
    </div>
  );
}

export function GroupsList({ instanceId, connected, groups }: GroupsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  function handleSync() {
    if (!instanceId) return;
    startTransition(async () => {
      const res = await syncGroupsAction(instanceId);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.remoteJid.includes(q));
  }, [groups, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Trocar a busca ou o grupo sumir (desabilitou/sincronizou de novo) pode
  // deixar a página atual além do fim — sem isso a lista renderiza vazia
  // mesmo tendo resultado.
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleQueryChange(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <Section
      title="Grupos"
      description="Só os grupos habilitados aqui recebem as ofertas do envio automático."
      actions={
        <Button size="sm" variant="outline" onClick={handleSync} disabled={!instanceId || !connected || isPending}>
          {isPending ? (
            <HugeiconsIcon icon={IconCarregando} size={14} strokeWidth={1.8} className="animate-spin" aria-hidden="true" />
          ) : (
            <HugeiconsIcon icon={IconAtualizar} size={14} strokeWidth={1.8} aria-hidden="true" />
          )}
          Sincronizar grupos
        </Button>
      }
    >
      {!instanceId ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Conecte uma instância pra ver os grupos disponíveis.
        </p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <HugeiconsIcon icon={IconGrupos} size={28} strokeWidth={1.5} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Nenhum grupo sincronizado ainda. Clique em &quot;Sincronizar grupos&quot; depois de conectar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.length > PAGE_SIZE && (
            <div className="relative">
              <HugeiconsIcon
                icon={IconBuscar}
                size={15}
                strokeWidth={1.8}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Buscar grupo pelo nome..."
                className="pl-8"
              />
            </div>
          )}

          {pageItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum grupo bate com &quot;{query}&quot;.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pageItems.map((group) => (
                <GroupRow key={group.id} group={group} />
              ))}
            </div>
          )}

          <Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPageChange={setPage} />
        </div>
      )}
    </Section>
  );
}
