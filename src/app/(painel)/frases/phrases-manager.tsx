"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ListPlus, Plus, Search } from "lucide-react";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PhraseGroup } from "@/lib/data/phrases";
import { PhraseRow } from "./phrase-row";
import { PhraseDialog } from "./phrase-dialog";
import { BulkAddDialog } from "./bulk-add-dialog";
import type { Phrase } from "@/generated/prisma";

export interface PhrasesManagerProps {
  groups: PhraseGroup[];
  categories: string[];
}

type SortBy = "recent" | "usage";

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

export function PhrasesManager({ groups, categories }: PhrasesManagerProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);

  const totalPhrases = groups.reduce((acc, g) => acc + g.phrases.length, 0);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((group) => {
        let phrases = group.phrases;
        if (q) phrases = phrases.filter((p) => p.text.toLowerCase().includes(q));
        if (sortBy === "usage") phrases = [...phrases].sort((a, b) => b.usageCount - a.usageCount);
        return { ...group, phrases };
      })
      .filter((group) => group.phrases.length > 0);
  }, [groups, search, sortBy]);

  function toggleCollapsed(category: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar frase..."
              className="pl-8"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="usage">Mais usadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <ListPlus className="size-3.5" />
            Adicionar várias
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Nova frase
          </Button>
        </div>
      </div>

      {totalPhrases === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Nenhuma frase cadastrada"
          description="Crie a primeira frase ou cole uma lista pronta."
          action={
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Nova frase
            </Button>
          }
        />
      ) : filteredGroups.length === 0 ? (
        <EmptyState icon={Search} title="Nenhuma frase encontrada" description="Tente outro termo de busca." />
      ) : (
        filteredGroups.map((group) => {
          const isCollapsed = collapsed.has(group.category);
          return (
            <Section
              key={group.category}
              title={capitalize(group.category)}
              description={`${group.phrases.length} frase${group.phrases.length === 1 ? "" : "s"}`}
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggleCollapsed(group.category)}
                  aria-label={isCollapsed ? "Expandir" : "Recolher"}
                  title={isCollapsed ? "Expandir" : "Recolher"}
                >
                  <ChevronDown className={cn("size-4 transition-transform", isCollapsed && "-rotate-90")} />
                </Button>
              }
            >
              {!isCollapsed && (
                <div className="flex flex-col divide-y divide-border">
                  {group.phrases.map((phrase) => (
                    <PhraseRow key={phrase.id} phrase={phrase} onEdit={() => setEditing(phrase)} />
                  ))}
                </div>
              )}
            </Section>
          );
        })
      )}

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
