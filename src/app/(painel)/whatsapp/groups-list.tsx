"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconGrupos, IconAtualizar, IconCarregando } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { WhatsappGroupRow } from "@/lib/data/whatsapp";
import { syncGroupsAction, toggleGroupAction } from "./actions";

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
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <GroupRow key={group.id} group={group} />
          ))}
        </div>
      )}
    </Section>
  );
}
