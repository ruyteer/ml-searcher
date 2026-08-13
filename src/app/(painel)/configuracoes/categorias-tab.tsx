"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconAdicionar,
  IconEditar,
  IconExcluir,
  IconAlerta,
  IconBuscar,
  IconLigar,
  IconDesligar,
  IconAtualizar,
  IconFechar,
  IconFiltrar,
} from "@/components/icons";
import { toast } from "sonner";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { HelpTooltip } from "./field";
import {
  deleteWatchesAction,
  toggleWatchAction,
  setWatchesEnabledAction,
  syncCategoryTreeAction,
  restaurarCategoriasDescartadasAction,
  loadCategoriaNumerosAction,
} from "./actions";
import { INITIAL_ACTION_STATE, type CategoriaNumeros } from "./action-state";
import { useActionToast } from "./use-action-toast";
import { SaveButton } from "./save-button";
import { WatchDialog } from "./watch-dialog";
import type { Watch } from "@/generated/prisma";

interface CategoriasTabProps {
  /// Já vem em ordem de árvore (pai antes das filhas) — ver listWatchTree().
  watches: Watch[];
  globalMinDiscount: number;
}

/// Quantas linhas a tabela desenha de uma vez. Com centenas de categorias,
/// desenhar tudo de uma vez trava a rolagem — o resto vem no "Mostrar mais".
const PAGINA = 60;

// Quatro filtros independentes (se combinam com "e"), em vez de um único
// seletor que misturava estado, oferta e nicho numa lista só. São os que o
// usuário realmente usa para achar uma categoria específica entre centenas.
type FiltroEstado = "todas" | "ligadas" | "desligadas";
type FiltroOferta = "todas" | "com" | "sem";
type FiltroNicho = "todas" | "dentro" | "fora";
type FiltroTermo = "todas" | "com" | "sem";

const ESTADO_OPCOES: { valor: FiltroEstado; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "ligadas", label: "Ligadas" },
  { valor: "desligadas", label: "Desligadas" },
];
const OFERTA_OPCOES: { valor: FiltroOferta; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "com", label: "Com oferta" },
  { valor: "sem", label: "Sem oferta" },
];
const NICHO_OPCOES: { valor: FiltroNicho; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "dentro", label: "Cuidado masculino" },
  { valor: "fora", label: "Fora do cuidado masculino" },
];
const TERMO_OPCOES: { valor: FiltroTermo; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "com", label: "Com termo de busca" },
  { valor: "sem", label: "Sem termo de busca" },
];

interface GrupoFiltroProps<T extends string> {
  titulo: string;
  opcoes: { valor: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}

/// Um dos quatro grupos dentro do popover de filtros: um rótulo pequeno e um
/// conjunto de botões, um único selecionado por vez dentro do grupo.
function GrupoFiltro<T extends string>({ titulo, opcoes, valor, onChange, disabled }: GrupoFiltroProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
      <div className="flex flex-wrap gap-1">
        {opcoes.map((o) => (
          <Button
            key={o.valor}
            type="button"
            variant={valor === o.valor ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={() => onChange(o.valor)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface FiltroChipProps {
  label: string;
  onClear: () => void;
}

/// Badge removível que mostra um filtro ativo direto na tela, sem precisar
/// abrir o popover para saber o que está filtrando.
function FiltroChip({ label, onClear }: FiltroChipProps) {
  return (
    <Badge variant="secondary" className="gap-1 py-0.5 pr-1 text-[11px]">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover filtro ${label}`}
        className="rounded-full p-0.5 hover:bg-foreground/15"
      >
        <HugeiconsIcon icon={IconFechar} size={10} strokeWidth={2} aria-hidden="true" />
      </button>
    </Badge>
  );
}

interface Confirmacao {
  titulo: string;
  descricao: ReactNode;
  /// Rótulos do que será afetado, à vista antes de confirmar.
  lista: string[];
  rotuloConfirmar: string;
  destrutivo: boolean;
  executar: () => Promise<void>;
}

export function CategoriasTab({ watches, globalMinDiscount }: CategoriasTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editingWatch, setEditingWatch] = useState<Watch | null>(null);

  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  /// Excluídas nesta sessão: somem da tabela na hora, sem esperar o recarregamento.
  const [removidas, setRemovidas] = useState<Set<string>>(new Set());
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [executando, setExecutando] = useState(false);

  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("todas");
  const [oferta, setOferta] = useState<FiltroOferta>("todas");
  const [nicho, setNicho] = useState<FiltroNicho>("todas");
  const [termo, setTermo] = useState<FiltroTermo>("todas");
  const [visiveis, setVisiveis] = useState(PAGINA);

  const [numeros, setNumeros] = useState<Map<string, CategoriaNumeros> | null>(null);
  const [, startTransition] = useTransition();

  const [syncState, syncFormAction] = useActionState(syncCategoryTreeAction, INITIAL_ACTION_STATE);
  useActionToast(syncState);
  const [restoreState, restoreFormAction] = useActionState(
    restaurarCategoriasDescartadasAction,
    INITIAL_ACTION_STATE,
  );
  useActionToast(restoreState);

  // Produtos, ofertas e leitura de nicho vêm depois da página abrir: a tabela
  // aparece na hora e os números entram assim que chegam.
  useEffect(() => {
    let vivo = true;
    startTransition(async () => {
      const resultado = await loadCategoriaNumerosAction();
      if (!vivo) return;
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      setNumeros(new Map(resultado.itens.map((item) => [item.id, item])));
    });
    return () => {
      vivo = false;
    };
    // Recarrega quando a lista muda de tamanho (exclusão, sincronização).
  }, [watches.length, syncState.ts, restoreState.ts]);

  const lista = useMemo(() => watches.filter((w) => !removidas.has(w.id)), [watches, removidas]);

  // Mapa categoria pai -> filhas diretas, pra achar o ramo inteiro de um nó
  // ao ligar/desligar ou excluir em bloco.
  const filhasPorPai = useMemo(() => {
    const map = new Map<string, Watch[]>();
    for (const w of lista) {
      if (!w.parentCategoryId) continue;
      const bucket = map.get(w.parentCategoryId);
      if (bucket) bucket.push(w);
      else map.set(w.parentCategoryId, [w]);
    }
    return map;
  }, [lista]);

  function descendentes(watch: Watch): Watch[] {
    if (!watch.categoryId) return [];
    const diretas = filhasPorPai.get(watch.categoryId) ?? [];
    const out: Watch[] = [];
    for (const filha of diretas) out.push(filha, ...descendentes(filha));
    return out;
  }

  function ligada(watch: Watch): boolean {
    return optimistic[watch.id] ?? watch.enabled;
  }

  function numerosDe(id: string): CategoriaNumeros | null {
    return numeros?.get(id) ?? null;
  }

  function foraDoNicho(watch: Watch): boolean {
    return numerosDe(watch.id)?.nicho === "fora";
  }

  function cuidadoMasculino(watch: Watch): boolean {
    return numerosDe(watch.id)?.nicho === "masculino";
  }

  const naoMasculinas = useMemo(
    () => (numeros ? lista.filter((w) => !cuidadoMasculino(w)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lista, numeros],
  );
  const naoMasculinasLigadas = naoMasculinas.filter(ligada);

  const semOferta = useMemo(
    () => (numeros ? lista.filter((w) => (numerosDe(w.id)?.ofertas ?? 0) === 0) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lista, numeros],
  );

  const busca = search.trim().toLowerCase();
  const filtradas = useMemo(() => {
    return lista.filter((w) => {
      if (busca) {
        const casa =
          w.label.toLowerCase().includes(busca) ||
          (w.categoryId ?? "").toLowerCase().includes(busca);
        if (!casa) return false;
      }
      if (estado === "ligadas" && !ligada(w)) return false;
      if (estado === "desligadas" && ligada(w)) return false;
      if (termo === "com" && !w.query) return false;
      if (termo === "sem" && w.query) return false;
      if (oferta !== "todas") {
        if (!numeros) return false;
        const temOferta = (numerosDe(w.id)?.ofertas ?? 0) > 0;
        if (oferta === "com" && !temOferta) return false;
        if (oferta === "sem" && temOferta) return false;
      }
      if (nicho !== "todas") {
        if (!numeros) return false;
        const dentro = cuidadoMasculino(w);
        if (nicho === "dentro" && !dentro) return false;
        if (nicho === "fora" && dentro) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, busca, estado, oferta, nicho, termo, numeros, optimistic]);

  const filtrosAtivos = [estado, oferta, nicho, termo].filter((v) => v !== "todas").length;
  const temFiltroOuBusca = filtrosAtivos > 0 || busca !== "";

  function limparFiltros() {
    setSearch("");
    setEstado("todas");
    setOferta("todas");
    setNicho("todas");
    setTermo("todas");
    setVisiveis(PAGINA);
  }

  const naTela = filtradas.slice(0, visiveis);
  const selecionadasVisiveis = naTela.filter((w) => selecionadas.has(w.id)).length;
  const todasVisiveisSelecionadas = naTela.length > 0 && selecionadasVisiveis === naTela.length;

  function alternarSelecao(id: string, marcada: boolean) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (marcada) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  function alternarTodasVisiveis(marcar: boolean) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      for (const w of naTela) {
        if (marcar) proximo.add(w.id);
        else proximo.delete(w.id);
      }
      return proximo;
    });
  }

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

  /// Liga/desliga um monte de uma vez, numa chamada só.
  async function ligarEmLote(alvos: Watch[], next: boolean) {
    const ids = alvos.map((w) => w.id);
    if (ids.length === 0) return;

    setOptimistic((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, next])) }));
    setTogglingIds((s) => new Set([...s, ...ids]));

    const result = await setWatchesEnabledAction(ids, next);

    setTogglingIds((s) => {
      const n = new Set(s);
      for (const id of ids) n.delete(id);
      return n;
    });

    if (result.ok) {
      toast.success(result.message);
    } else {
      setOptimistic((s) => ({
        ...s,
        ...Object.fromEntries(alvos.map((w) => [w.id, w.enabled])), // reverte
      }));
      toast.error(result.message);
    }
  }

  async function excluirEmLote(alvos: Watch[]) {
    const ids = alvos.map((w) => w.id);
    if (ids.length === 0) return;

    const result = await deleteWatchesAction(ids);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    // Some da tabela na hora: com dezenas de linhas, esperar o recarregamento
    // do servidor daria a sensação de travamento.
    setRemovidas((s) => new Set([...s, ...result.excluidos]));
    setSelecionadas((s) => {
      const proximo = new Set(s);
      for (const id of result.excluidos) proximo.delete(id);
      return proximo;
    });
    toast.success(result.message);
  }

  async function confirmar() {
    if (!confirmacao) return;
    setExecutando(true);
    try {
      await confirmacao.executar();
    } finally {
      setExecutando(false);
      setConfirmacao(null);
    }
  }

  // ------------------------------------------------------------- confirmações

  function rotulos(alvos: Watch[]): string[] {
    return alvos.map((w) => (w.categoryId ? `${w.label} (${w.categoryId})` : w.label));
  }

  const AVISO_PRODUTOS =
    "Os produtos já coletados não somem: eles continuam no catálogo, só ficam sem categoria. Histórico de preço e ofertas seguem intactos.";
  const AVISO_SINCRONIZACAO =
    "A sincronização automática não traz essas categorias de volta: o que você exclui fica excluído.";

  function pedirExclusao(alvos: Watch[], titulo: string) {
    setConfirmacao({
      titulo,
      descricao: (
        <>
          A varredura para de rodar para {alvos.length === 1 ? "ela" : "elas"}. {AVISO_PRODUTOS}{" "}
          {AVISO_SINCRONIZACAO}
        </>
      ),
      lista: rotulos(alvos),
      rotuloConfirmar: `Excluir ${alvos.length === 1 ? "categoria" : `${alvos.length} categorias`}`,
      destrutivo: true,
      executar: () => excluirEmLote(alvos),
    });
  }

  function pedirExclusaoDoRamo(raiz: Watch) {
    const alvos = [raiz, ...descendentes(raiz)];
    pedirExclusao(alvos, `Excluir "${raiz.label}" e tudo abaixo dela?`);
  }

  function pedirFaxinaSemOferta() {
    if (semOferta.length === 0) {
      toast.info("Todas as categorias da lista já renderam pelo menos uma oferta.");
      return;
    }
    setConfirmacao({
      titulo: `Excluir ${semOferta.length} categorias que nunca renderam oferta?`,
      descricao: (
        <>
          Essas categorias já foram varridas e não produziram nenhuma oferta até agora.{" "}
          {AVISO_PRODUTOS} {AVISO_SINCRONIZACAO}
        </>
      ),
      lista: rotulos(semOferta),
      rotuloConfirmar: `Excluir ${semOferta.length} categorias`,
      destrutivo: true,
      executar: () => excluirEmLote(semOferta),
    });
  }

  function pedirDesligarForaDoNicho() {
    if (naoMasculinasLigadas.length === 0) {
      toast.info("Todas as categorias ligadas já são de cuidado pessoal masculino.");
      return;
    }
    setConfirmacao({
      titulo: `Desligar ${naoMasculinasLigadas.length} categorias fora do cuidado masculino?`,
      descricao: (
        <>
          Elas param de entrar na varredura, mas continuam na lista: é só religar se quiser. Nada é
          excluído aqui.
        </>
      ),
      lista: rotulos(naoMasculinasLigadas),
      rotuloConfirmar: `Desligar ${naoMasculinasLigadas.length} categorias`,
      destrutivo: false,
      executar: () => ligarEmLote(naoMasculinasLigadas, false),
    });
  }

  const selecionadasLista = lista.filter((w) => selecionadas.has(w.id));

  return (
    <>
      <Section
        title="Categorias monitoradas"
        description="A varredura passa em cada categoria ligada procurando queda de preço. Menos categoria e mais específica rende oferta melhor do que muita categoria genérica."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <form action={syncFormAction}>
              <SaveButton
                variant="outline"
                size="sm"
                className="gap-1.5"
                label="Buscar categorias no Mercado Livre"
                pendingLabel="Buscando..."
              >
                <HugeiconsIcon icon={IconAtualizar} size={14} strokeWidth={1.6} aria-hidden="true" />
                Buscar categorias no Mercado Livre
              </SaveButton>
            </form>
            <HelpTooltip label="Buscar categorias no Mercado Livre">
              Traz a lista oficial de categorias e cria as que faltam, sem mexer no que você já
              ligou, desligou ou ajustou, e sem trazer de volta o que você excluiu.
            </HelpTooltip>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <HugeiconsIcon icon={IconAdicionar} size={16} strokeWidth={1.8} aria-hidden="true" /> Nova
              categoria
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <div className="relative">
            <HugeiconsIcon
              icon={IconBuscar}
              size={14}
              strokeWidth={1.6}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisiveis(PAGINA);
              }}
              placeholder="Buscar por nome ou código da categoria..."
              className="max-w-md pl-8 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={IconFechar} size={13} strokeWidth={1.8} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5 text-xs",
                  filtrosAtivos > 0 && "border-primary/40 text-foreground",
                )}
              >
                <HugeiconsIcon icon={IconFiltrar} size={13} strokeWidth={1.6} aria-hidden="true" />
                Filtros
                {filtrosAtivos > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {filtrosAtivos}
                  </Badge>
                )}
              </PopoverTrigger>
              <PopoverContent className="flex w-72 flex-col gap-3" align="start">
                <GrupoFiltro
                  titulo="Estado"
                  opcoes={ESTADO_OPCOES}
                  valor={estado}
                  onChange={(v) => {
                    setEstado(v);
                    setVisiveis(PAGINA);
                  }}
                />
                <GrupoFiltro
                  titulo="Ofertas"
                  opcoes={OFERTA_OPCOES}
                  valor={oferta}
                  disabled={!numeros}
                  onChange={(v) => {
                    setOferta(v);
                    setVisiveis(PAGINA);
                  }}
                />
                <GrupoFiltro
                  titulo="Nicho"
                  opcoes={NICHO_OPCOES}
                  valor={nicho}
                  disabled={!numeros}
                  onChange={(v) => {
                    setNicho(v);
                    setVisiveis(PAGINA);
                  }}
                />
                <GrupoFiltro
                  titulo="Termo de busca"
                  opcoes={TERMO_OPCOES}
                  valor={termo}
                  onChange={(v) => {
                    setTermo(v);
                    setVisiveis(PAGINA);
                  }}
                />
              </PopoverContent>
            </Popover>

            {estado !== "todas" && (
              <FiltroChip
                label={ESTADO_OPCOES.find((o) => o.valor === estado)!.label}
                onClear={() => setEstado("todas")}
              />
            )}
            {oferta !== "todas" && (
              <FiltroChip
                label={OFERTA_OPCOES.find((o) => o.valor === oferta)!.label}
                onClear={() => setOferta("todas")}
              />
            )}
            {nicho !== "todas" && (
              <FiltroChip
                label={NICHO_OPCOES.find((o) => o.valor === nicho)!.label}
                onClear={() => setNicho("todas")}
              />
            )}
            {termo !== "todas" && (
              <FiltroChip
                label={TERMO_OPCOES.find((o) => o.valor === termo)!.label}
                onClear={() => setTermo("todas")}
              />
            )}
            {temFiltroOuBusca && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            )}

            <p className="ml-auto text-sm text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{naTela.length}</span> de{" "}
              <span className="font-medium text-foreground">{filtradas.length}</span> categorias
            </p>
          </div>

          {/* Faxinas de uma tacada só, o que resolve uma lista com centenas de linhas. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={!numeros}
              onClick={pedirFaxinaSemOferta}
            >
              <HugeiconsIcon icon={IconExcluir} size={13} strokeWidth={1.6} aria-hidden="true" />
              Limpar as que nunca renderam oferta
              {numeros && <Badge variant="secondary" className="text-[10px]">{semOferta.length}</Badge>}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={!numeros}
              onClick={pedirDesligarForaDoNicho}
            >
              <HugeiconsIcon icon={IconDesligar} size={13} strokeWidth={1.6} aria-hidden="true" />
              Desligar tudo que não é cuidado masculino
              {numeros && (
                <Badge variant="secondary" className="text-[10px]">{naoMasculinasLigadas.length}</Badge>
              )}
            </Button>
            <form action={restoreFormAction}>
              <SaveButton
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                label="Liberar as categorias que excluí"
                pendingLabel="Liberando..."
              >
                Liberar as categorias que excluí
              </SaveButton>
            </form>
          </div>

          {selecionadas.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="text-sm">
                <span className="font-medium">{selecionadas.size}</span>{" "}
                {selecionadas.size === 1 ? "categoria selecionada" : "categorias selecionadas"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => ligarEmLote(selecionadasLista, true)}
                >
                  Ligar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => ligarEmLote(selecionadasLista, false)}
                >
                  Desligar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelecionadas(new Set())}
                >
                  Limpar seleção
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() =>
                    pedirExclusao(
                      selecionadasLista,
                      `Excluir ${selecionadasLista.length} categorias selecionadas?`,
                    )
                  }
                >
                  <HugeiconsIcon icon={IconExcluir} size={13} strokeWidth={1.6} aria-hidden="true" />
                  Excluir selecionadas
                </Button>
              </div>
            </div>
          )}
        </div>

        {lista.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria monitorada"
            description="Busque as categorias no Mercado Livre ou crie a primeira na mão."
            action={
              <Button size="sm" onClick={openCreate}>
                Nova categoria
              </Button>
            }
          />
        ) : filtradas.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria encontrada"
            description={busca ? `Nada corresponde a "${search}".` : "Nenhuma categoria neste filtro."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={todasVisiveisSelecionadas}
                      onCheckedChange={(v) => alternarTodasVisiveis(v === true)}
                      aria-label="Selecionar todas as categorias desta tela"
                    />
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Termo
                      <HelpTooltip label="Termo de busca">
                        Categoria com termo de busca varre o catálogo do Mercado Livre por aquele termo, o
                        que alcança muito mais produto do que os destaques da categoria sozinha.
                      </HelpTooltip>
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-right">Ofertas</TableHead>
                  <TableHead>Desconto mínimo</TableHead>
                  <TableHead>Ligada</TableHead>
                  <TableHead>Última varredura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {naTela.map((watch) => {
                  const enabled = ligada(watch);
                  const filhas = descendentes(watch);
                  const temFilhas = filhas.length > 0;
                  const n = numerosDe(watch.id);
                  const fora = foraDoNicho(watch);
                  const neutra = Boolean(n) && n?.nicho === "neutro";

                  return (
                    <TableRow key={watch.id} data-selected={selecionadas.has(watch.id) || undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selecionadas.has(watch.id)}
                          onCheckedChange={(v) => alternarSelecao(watch.id, v === true)}
                          aria-label={`Selecionar ${watch.label}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2" style={{ paddingLeft: watch.depth * 20 }}>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{watch.label}</span>
                              {!watch.auto && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Criada por você
                                </Badge>
                              )}
                              {fora && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-amber-500/40 text-[10px] text-amber-500"
                                >
                                  <HugeiconsIcon icon={IconAlerta} size={10} strokeWidth={2} aria-hidden="true" />
                                  Fora do cuidado masculino
                                </Badge>
                              )}
                              {neutra && (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Não é cuidado masculino
                                </Badge>
                              )}
                            </div>
                            {watch.categoryId && <Badge variant="outline">{watch.categoryId}</Badge>}
                          </div>
                          {temFilhas && (
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => ligarEmLote([watch, ...filhas], !enabled)}
                                title={`${enabled ? "Desliga" : "Liga"} esta categoria e as ${filhas.length} de dentro dela`}
                              >
                                <HugeiconsIcon
                                  icon={enabled ? IconDesligar : IconLigar}
                                  size={12}
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                />
                                {enabled ? "Desligar ramo" : "Ligar ramo"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => pedirExclusaoDoRamo(watch)}
                                title={`Exclui esta categoria e as ${filhas.length} de dentro dela`}
                              >
                                <HugeiconsIcon icon={IconExcluir} size={12} strokeWidth={1.8} aria-hidden="true" />
                                Excluir ramo ({filhas.length + 1})
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {watch.query ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">&quot;{watch.query}&quot;</span>
                            {watch.domainId && (
                              <span className="text-[10px] text-muted-foreground/70">
                                tipo de produto: {watch.domainId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {n ? n.produtos : <span className="text-muted-foreground">...</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {n ? (
                          n.ofertas > 0 ? (
                            <span className="font-medium">{n.ofertas}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">...</span>
                        )}
                      </TableCell>
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
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => pedirExclusao([watch], `Excluir "${watch.label}"?`)}
                          >
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

            {filtradas.length > naTela.length && (
              <div className="mt-4 flex items-center justify-center">
                <Button variant="outline" size="sm" onClick={() => setVisiveis((v) => v + PAGINA)}>
                  Mostrar mais
                </Button>
              </div>
            )}
          </>
        )}
      </Section>

      <WatchDialog key={dialogKey} open={dialogOpen} watch={editingWatch} onOpenChange={setDialogOpen} />

      <AlertDialog
        open={Boolean(confirmacao)}
        onOpenChange={(open) => {
          if (!open && !executando) setConfirmacao(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacao?.titulo}</AlertDialogTitle>
            <AlertDialogDescription>{confirmacao?.descricao}</AlertDialogDescription>
          </AlertDialogHeader>

          {confirmacao && confirmacao.lista.length > 0 && (
            <div className="rounded-lg border border-border">
              <p className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
                {confirmacao.lista.length === 1
                  ? "A categoria afetada:"
                  : `As ${confirmacao.lista.length} categorias afetadas:`}
              </p>
              <ul className="max-h-52 overflow-y-auto px-3 py-2 text-xs">
                {confirmacao.lista.map((rotulo) => (
                  <li key={rotulo} className="py-0.5 text-muted-foreground">
                    {rotulo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={executando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmacao?.destrutivo ? "destructive" : undefined}
              disabled={executando}
              onClick={confirmar}
            >
              {executando ? "Aplicando..." : confirmacao?.rotuloConfirmar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
