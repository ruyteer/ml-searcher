"use client";

import { useActionState, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconAdicionar,
  IconEditar,
  IconExcluir,
  IconInfo,
  IconBuscar,
  IconLigar,
  IconDesligar,
  IconAtualizar,
} from "@/components/icons";
import { toast } from "sonner";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { formatDateTime } from "@/lib/format";
import { deleteWatchAction, toggleWatchAction, syncCategoryTreeAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import { useActionToast } from "./use-action-toast";
import { SaveButton } from "./save-button";
import { WatchDialog } from "./watch-dialog";
import type { Watch } from "@/generated/prisma";

interface CategoriasTabProps {
  /// Já vem em ordem de árvore (pai antes das filhas) — ver listWatchTree().
  watches: Watch[];
  globalMinDiscount: number;
}

export function CategoriasTab({ watches, globalMinDiscount }: CategoriasTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editingWatch, setEditingWatch] = useState<Watch | null>(null);

  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const [deleteTarget, setDeleteTarget] = useState<Watch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");

  const [syncState, syncFormAction] = useActionState(syncCategoryTreeAction, INITIAL_ACTION_STATE);
  useActionToast(syncState);

  // Mapa categoria pai -> filhas diretas, pra achar o ramo inteiro de um nó
  // ao ligar/desligar em bloco.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Watch[]>();
    for (const w of watches) {
      if (!w.parentCategoryId) continue;
      const bucket = map.get(w.parentCategoryId);
      if (bucket) bucket.push(w);
      else map.set(w.parentCategoryId, [w]);
    }
    return map;
  }, [watches]);

  function getDescendants(watch: Watch): Watch[] {
    if (!watch.categoryId) return [];
    const direct = childrenByParent.get(watch.categoryId) ?? [];
    const out: Watch[] = [];
    for (const child of direct) {
      out.push(child, ...getDescendants(child));
    }
    return out;
  }

  const enabledCount = watches.filter((w) => optimistic[w.id] ?? w.enabled).length;

  const normalizedSearch = search.trim().toLowerCase();
  const visibleWatches = normalizedSearch
    ? watches.filter(
        (w) =>
          w.label.toLowerCase().includes(normalizedSearch) ||
          (w.categoryId ?? "").toLowerCase().includes(normalizedSearch),
      )
    : watches;

  function openCreate() {
    setEditingWatch(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(watch: Watch) {
    setEditingWatch(watch);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  async function handleToggle(watch: Watch, next: boolean) {
    setOptimistic((s) => ({ ...s, [watch.id]: next }));
    setTogglingIds((s) => new Set(s).add(watch.id));
    const result = await toggleWatchAction(watch.id, next);
    setTogglingIds((s) => {
      const n = new Set(s);
      n.delete(watch.id);
      return n;
    });
    if (!result.ok) {
      setOptimistic((s) => ({ ...s, [watch.id]: watch.enabled })); // reverte
      toast.error(result.message);
    }
  }

  async function handleToggleBranch(root: Watch, next: boolean) {
    const targets = [root, ...getDescendants(root)];
    const ids = targets.map((w) => w.id);

    setOptimistic((s) => {
      const patch = Object.fromEntries(ids.map((id) => [id, next]));
      return { ...s, ...patch };
    });
    setTogglingIds((s) => new Set([...s, ...ids]));

    const results = await Promise.all(targets.map((w) => toggleWatchAction(w.id, next)));

    setTogglingIds((s) => {
      const n = new Set(s);
      for (const id of ids) n.delete(id);
      return n;
    });

    const failed = targets.filter((_, i) => !results[i].ok);
    if (failed.length > 0) {
      setOptimistic((s) => {
        const patch = Object.fromEntries(failed.map((w) => [w.id, w.enabled])); // reverte só as que falharam
        return { ...s, ...patch };
      });
      toast.error(`${failed.length} de ${ids.length} categorias do ramo não foram atualizadas.`);
    } else {
      toast.success(
        `${ids.length} categoria${ids.length > 1 ? "s" : ""} do ramo "${root.label}" ${next ? "ligadas" : "desligadas"}.`,
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const fd = new FormData();
    fd.set("id", deleteTarget.id);
    const result = await deleteWatchAction(INITIAL_ACTION_STATE, fd);
    setDeleting(false);
    if (result.ok) {
      toast.success(result.message);
      setDeleteTarget(null);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <Section
        title="Categorias monitoradas"
        description="Árvore de categorias do Mercado Livre: o scraper varre cada categoria ligada, por destaques."
        actions={
          <div className="flex items-center gap-2">
            <form action={syncFormAction}>
              <SaveButton
                variant="outline"
                size="sm"
                className="gap-1.5"
                label="Sincronizar categorias do Mercado Livre"
                pendingLabel="Sincronizando..."
              >
                <HugeiconsIcon icon={IconAtualizar} size={14} strokeWidth={1.6} aria-hidden="true" />
                Sincronizar categorias do Mercado Livre
              </SaveButton>
            </form>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <HugeiconsIcon icon={IconAdicionar} size={16} strokeWidth={1.8} aria-hidden="true" /> Nova categoria
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <HugeiconsIcon icon={IconInfo} size={14} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Categoria com termo de busca varre o catálogo do Mercado Livre por aquele termo, o que
              alcança muito mais produto do que os destaques da categoria sozinha. Para o termo não
              trazer produto de outra área, preencha também o domínio de catálogo: o formulário tem um
              botão para descobrir o domínio certo a partir do termo digitado. &quot;Sincronizar
              categorias do Mercado Livre&quot; busca a árvore oficial de categorias e cria/atualiza uma
              watch por categoria, sem sobrescrever o que você já ligou, desligou ou ajustou.
            </span>
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{enabledCount}</span> de{" "}
              <span className="font-medium text-foreground">{watches.length}</span> categorias monitoradas
            </p>
            <div className="relative w-full max-w-xs">
              <HugeiconsIcon
                icon={IconBuscar}
                size={14}
                strokeWidth={1.6}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou ID de categoria..."
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {watches.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria monitorada"
            description="Sincronize a árvore de categorias do Mercado Livre ou crie a primeira categoria na mão."
            action={
              <Button size="sm" onClick={openCreate}>
                Nova categoria
              </Button>
            }
          />
        ) : visibleWatches.length === 0 ? (
          <EmptyState title="Nenhuma categoria encontrada" description={`Nada corresponde a "${search}".`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Termo</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Desconto mínimo</TableHead>
                <TableHead>Ligada</TableHead>
                <TableHead>Última varredura</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleWatches.map((watch) => {
                const enabled = optimistic[watch.id] ?? watch.enabled;
                const descendants = getDescendants(watch);
                const hasChildren = descendants.length > 0;

                return (
                  <TableRow key={watch.id}>
                    <TableCell>
                      <div className="flex items-start gap-2" style={{ paddingLeft: watch.depth * 20 }}>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{watch.label}</span>
                            {!watch.auto && (
                              <Badge variant="secondary" className="text-[10px]">
                                Manual
                              </Badge>
                            )}
                          </div>
                          {watch.categoryId && <Badge variant="outline">{watch.categoryId}</Badge>}
                        </div>
                        {hasChildren && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleBranch(watch, !enabled)}
                            title={`${enabled ? "Desliga" : "Liga"} esta categoria e as ${descendants.length} descendentes`}
                          >
                            {enabled ? (
                              <HugeiconsIcon icon={IconDesligar} size={12} strokeWidth={1.8} aria-hidden="true" />
                            ) : (
                              <HugeiconsIcon icon={IconLigar} size={12} strokeWidth={1.8} aria-hidden="true" />
                            )}
                            {enabled ? "Desligar ramo" : "Ligar ramo"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {watch.query ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">&quot;{watch.query}&quot;</span>
                          {watch.domainId && (
                            <span className="font-mono text-[10px] text-muted-foreground/70">
                              {watch.domainId}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{watch.limit}</TableCell>
                    <TableCell>
                      {watch.minDiscount === null ? (
                        <span className="text-xs text-muted-foreground">Herda ({globalMinDiscount}%)</span>
                      ) : (
                        `${watch.minDiscount}%`
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={enabled}
                        disabled={togglingIds.has(watch.id)}
                        onCheckedChange={(v) => handleToggle(watch, v)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {watch.lastRunAt ? formatDateTime(watch.lastRunAt) : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(watch)}>
                          <HugeiconsIcon icon={IconEditar} size={14} strokeWidth={1.6} aria-hidden="true" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(watch)}>
                          <HugeiconsIcon icon={IconExcluir} size={14} strokeWidth={1.6} aria-hidden="true" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      <WatchDialog key={dialogKey} open={dialogOpen} watch={editingWatch} onOpenChange={setDialogOpen} />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &quot;{deleteTarget?.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              A varredura para de rodar para esta categoria. Os produtos e ofertas já coletados
              continuam no catálogo normalmente, só deixam de receber novidades por aqui.
              {deleteTarget?.auto && (
                <>
                  {" "}
                  Como esta categoria veio da sincronização automática, ela pode ser recriada na próxima
                  vez que você sincronizar a árvore do Mercado Livre.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

