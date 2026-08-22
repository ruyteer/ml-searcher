"use client";

import { useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { HugeiconsIcon } from "@hugeicons/react";
import { ListPlusIcon, PlusSignIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SORT_LABELS, type PhraseSortBy } from "@/lib/frases-labels";
import { IconAlerta } from "@/components/icons";
import type { PhraseGroup } from "@/lib/data/phrases";
import { PhraseRow } from "./phrase-row";
import { PhraseDialog } from "./phrase-dialog";
import { BulkAddDialog } from "./bulk-add-dialog";
import { AlertBox } from "./alert-box";
import type { WatchComboboxOption } from "./watch-combobox";
import type { Phrase } from "@/generated/prisma";

export interface PhrasesManagerProps {
  groups: PhraseGroup[];
  watches: WatchComboboxOption[];
}

/// Sentinela de URL/estado para o grupo "Sem categoria" (watchId nulo) — ""
/// já significa "todas as categorias" no filtro, então null precisa de outro
/// valor pra não colidir com ele.
const NONE_VALUE = "__none__";

interface CategoryFilterItem {
  /// "" = todas as categorias; NONE_VALUE = sem categoria; senão, o watchId.
  value: string;
  label: string;
  count: number;
}

/// Lista de frases pensada pra escalar a dezenas ou centenas de itens: uma
/// linha por frase (não um card), categoria como filtro lateral em vez de
/// uma seção por categoria, e grade de várias colunas em telas largas.
export function PhrasesManager({ groups, watches }: PhrasesManagerProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<PhraseSortBy>("recent");
  const [category, setCategory] = useQueryState("categoria", { defaultValue: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);

  const allPhrases = useMemo(() => groups.flatMap((g) => g.phrases), [groups]);
  const totalPhrases = allPhrases.length;

  // Rótulo do grupo de cada frase, pra badge de categoria da linha — Phrase
  // só guarda o watchId (cuid), quem resolve o texto pro usuário é aqui.
  const labelByWatchId = useMemo(() => {
    const map = new Map<string | null, string>();
    for (const g of groups) map.set(g.watchId, g.label);
    return map;
  }, [groups]);

  // Frases que batem com a busca, sem considerar a categoria selecionada
  // ainda: alimenta o contador por categoria na barra lateral.
  const matchingSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allPhrases.filter((p) => p.text.toLowerCase().includes(q)) : allPhrases;
  }, [allPhrases, search]);

  const categoryFilters: CategoryFilterItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of matchingSearch) {
      const key = p.watchId ?? NONE_VALUE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const items = groups.map((g) => {
      const key = g.watchId ?? NONE_VALUE;
      return { value: key, label: g.label, count: counts.get(key) ?? 0 };
    });
    return [{ value: "", label: "Todas", count: matchingSearch.length }, ...items];
  }, [groups, matchingSearch]);

  const activeCategory = categoryFilters.some((c) => c.value === category) ? category : "";

  const visiblePhrases = useMemo(() => {
    let list = matchingSearch;
    if (activeCategory) {
      const targetWatchId = activeCategory === NONE_VALUE ? null : activeCategory;
      list = list.filter((p) => p.watchId === targetWatchId);
    }
    if (sortBy === "usage") list = [...list].sort((a, b) => b.usageCount - a.usageCount);
    return list;
  }, [matchingSearch, activeCategory, sortBy]);

  // Aviso de dia-um: a migration jogou toda frase existente em "Sem
  // categoria" (não havia como casar tipo de copy antigo com Watch). Se essa
  // pilha concentra a maioria das frases e já existem categorias cadastradas,
  // o usuário provavelmente não sabe que precisa recategorizar na mão — sem
  // isso, ofertas de categorias com Watch saem sem frase no WhatsApp.
  const semCategoriaCount = groups.find((g) => g.watchId === null)?.phrases.length ?? 0;
  const showMigrationWarning = watches.length > 0 && totalPhrases > 0 && semCategoriaCount / totalPhrases > 0.5;

  return (
    <div className="flex flex-col gap-4">
      {showMigrationWarning && (
        <AlertBox icon={IconAlerta} variant="warning" title="A maioria das frases está sem categoria">
          <p>
            {semCategoriaCount} de {totalPhrases} frases não têm categoria — a atualização que trouxe categorias
            reais não conseguiu adivinhar a qual categoria cada frase antiga pertencia. Enquanto isso, ofertas de
            categorias com Watch saem <strong>sem frase</strong> nas mensagens do WhatsApp: o pool &quot;Sem
            categoria&quot; não serve de reserva pra elas. Edite as frases e escolha uma categoria pra elas
            voltarem a aparecer.
          </p>
        </AlertBox>
      )}

      {/* Filtro de categoria em telas pequenas: chips roláveis na horizontal. */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 lg:hidden">
        {categoryFilters.map((c) => (
          <button
            key={c.value || "todas"}
            type="button"
            onClick={() => setCategory(c.value)}
            className={cn(
              "flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
              activeCategory === c.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {c.label} <span className="opacity-70">({c.count})</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr] lg:items-start">
        <div className="hidden lg:block">
          <Section title="Categorias" contentClassName="p-1.5">
            <div className="flex flex-col gap-0.5">
              {categoryFilters.map((c) => (
                <button
                  key={c.value || "todas"}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    activeCategory === c.value ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.count}</span>
                </button>
              ))}
            </div>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar frase..."
                  className="min-h-11 pl-8 sm:min-h-0"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as PhraseSortBy)}>
                <SelectTrigger size="sm" className="min-h-11 w-40 sm:min-h-0">
                  <SelectValue>{(v: PhraseSortBy) => SORT_LABELS[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">{SORT_LABELS.recent}</SelectItem>
                  <SelectItem value="usage">{SORT_LABELS.usage}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-11 sm:h-7" onClick={() => setBulkOpen(true)}>
                <HugeiconsIcon icon={ListPlusIcon} size={14} strokeWidth={1.5} />
                Adicionar várias
              </Button>
              <Button type="button" size="sm" className="h-11 sm:h-7" onClick={() => setCreateOpen(true)}>
                <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.5} />
                Nova frase
              </Button>
            </div>
          </div>

          {totalPhrases > 0 && (
            <p className="text-xs text-muted-foreground">
              {visiblePhrases.length} de {totalPhrases} frase{totalPhrases === 1 ? "" : "s"}
              {activeCategory
                ? ` na categoria "${categoryFilters.find((c) => c.value === activeCategory)?.label}"`
                : ""}
            </p>
          )}

          {totalPhrases === 0 ? (
            <EmptyState
              title="Nenhuma frase cadastrada"
              description="Crie a primeira frase ou cole uma lista pronta."
              action={
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.5} />
                  Nova frase
                </Button>
              }
            />
          ) : visiblePhrases.length === 0 ? (
            <EmptyState title="Nenhuma frase encontrada" description="Tente outro termo de busca ou outra categoria." />
          ) : (
            <div className="grid grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
              {visiblePhrases.map((phrase) => (
                <PhraseRow
                  key={phrase.id}
                  phrase={phrase}
                  onEdit={() => setEditing(phrase)}
                  categoryLabel={labelByWatchId.get(phrase.watchId) ?? "Sem categoria"}
                  showCategory={!activeCategory}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PhraseDialog
        key={editing ? `edit-${editing.id}` : createOpen ? "create-open" : "create-closed"}
        open={createOpen || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        phrase={editing}
        watches={watches}
      />
      <BulkAddDialog
        key={bulkOpen ? "bulk-open" : "bulk-closed"}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        watches={watches}
      />
    </div>
  );
}
