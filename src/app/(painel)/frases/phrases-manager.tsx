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
import { getCategoryLabel, SORT_LABELS, type PhraseSortBy } from "@/lib/frases-labels";
import type { PhraseGroup } from "@/lib/data/phrases";
import { PhraseRow } from "./phrase-row";
import { PhraseDialog } from "./phrase-dialog";
import { BulkAddDialog } from "./bulk-add-dialog";
import type { Phrase } from "@/generated/prisma";

export interface PhrasesManagerProps {
  groups: PhraseGroup[];
  categories: string[];
}

interface CategoryFilterItem {
  /// "" representa "todas as categorias".
  value: string;
  label: string;
  count: number;
}

/// Lista de frases pensada pra escalar a dezenas ou centenas de itens: uma
/// linha por frase (não um card), categoria como filtro lateral em vez de
/// uma seção por categoria, e grade de várias colunas em telas largas.
export function PhrasesManager({ groups, categories }: PhrasesManagerProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<PhraseSortBy>("recent");
  const [category, setCategory] = useQueryState("categoria", { defaultValue: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);

  const allPhrases = useMemo(() => groups.flatMap((g) => g.phrases), [groups]);
  const totalPhrases = allPhrases.length;

  // Frases que batem com a busca, sem considerar a categoria selecionada
  // ainda: alimenta o contador por categoria na barra lateral.
  const matchingSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allPhrases.filter((p) => p.text.toLowerCase().includes(q)) : allPhrases;
  }, [allPhrases, search]);

  const categoryFilters: CategoryFilterItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of matchingSearch) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    const items = groups.map((g) => ({
      value: g.category,
      label: getCategoryLabel(g.category),
      count: counts.get(g.category) ?? 0,
    }));
    return [{ value: "", label: "Todas", count: matchingSearch.length }, ...items];
  }, [groups, matchingSearch]);

  const activeCategory = categoryFilters.some((c) => c.value === category) ? category : "";

  const visiblePhrases = useMemo(() => {
    let list = activeCategory ? matchingSearch.filter((p) => p.category === activeCategory) : matchingSearch;
    if (sortBy === "usage") list = [...list].sort((a, b) => b.usageCount - a.usageCount);
    return list;
  }, [matchingSearch, activeCategory, sortBy]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro de categoria em telas pequenas: chips roláveis na horizontal. */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 lg:hidden">
        {categoryFilters.map((c) => (
          <button
            key={c.value || "todas"}
            type="button"
            onClick={() => setCategory(c.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
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
                  className="pl-8"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as PhraseSortBy)}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue>{(v: PhraseSortBy) => SORT_LABELS[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">{SORT_LABELS.recent}</SelectItem>
                  <SelectItem value="usage">{SORT_LABELS.usage}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                <HugeiconsIcon icon={ListPlusIcon} size={14} strokeWidth={1.5} />
                Adicionar várias
              </Button>
              <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.5} />
                Nova frase
              </Button>
            </div>
          </div>

          {totalPhrases > 0 && (
            <p className="text-xs text-muted-foreground">
              {visiblePhrases.length} de {totalPhrases} frase{totalPhrases === 1 ? "" : "s"}
              {activeCategory ? ` na categoria "${getCategoryLabel(activeCategory)}"` : ""}
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
        categories={categories}
      />
      <BulkAddDialog
        key={bulkOpen ? "bulk-open" : "bulk-closed"}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        categories={categories}
      />
    </div>
  );
}
