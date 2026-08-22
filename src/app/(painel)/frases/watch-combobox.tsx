"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconBuscar, IconChevronBaixo, IconMarcado } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface WatchComboboxOption {
  id: string;
  label: string;
  depth: number;
}

const NONE_LABEL = "Sem categoria";

export interface WatchComboboxProps {
  /// watchIds escolhidos. Lista vazia = "Sem categoria" (pool geral).
  value: string[];
  onChange: (next: string[]) => void;
  watches: WatchComboboxOption[];
  className?: string;
}

/// Combobox buscável de categorias (Watch), multi-seleção: uma frase pode
/// pertencer a várias categorias ao mesmo tempo. Escolhe só entre categorias
/// reais — criar categoria nova é coisa da aba "Categorias monitoradas", não
/// texto livre digitado aqui. "Sem categoria" fica fixa no topo e, ao ser
/// clicada, limpa a seleção inteira (`value = []`, pool geral). Indenta cada
/// opção por `depth`, mesma convenção da árvore de categorias em
/// Configurações. O popover não fecha ao marcar/desmarcar uma opção, só
/// quando o usuário fecha de propósito — assim dá pra marcar várias seguidas.
export function WatchCombobox({ value, onChange, watches, className }: WatchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (trimmedQuery ? watches.filter((w) => w.label.toLowerCase().includes(trimmedQuery)) : watches),
    [watches, trimmedQuery],
  );

  const selectedLabel =
    value.length === 0
      ? NONE_LABEL
      : value.length === 1
        ? (watches.find((w) => w.id === value[0])?.label ?? NONE_LABEL)
        : `${value.length} categorias`;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function clear() {
    onChange([]);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className={cn("w-full justify-between font-normal", className)}>
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>{selectedLabel}</span>
            <HugeiconsIcon icon={IconChevronBaixo} size={16} strokeWidth={1.5} className="shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-1.5" align="start">
        <div className="relative mb-1.5">
          <HugeiconsIcon
            icon={IconBuscar}
            size={13}
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoFocus
            placeholder="Buscar categoria..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-7"
          />
        </div>
        {value.length > 0 && (
          <p className="px-2 pb-1 text-xs text-muted-foreground">{value.length} selecionada{value.length > 1 ? "s" : ""}</p>
        )}
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-2 rounded-md border-b border-border px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <HugeiconsIcon
              icon={IconMarcado}
              size={14}
              strokeWidth={1.5}
              className={cn("shrink-0", value.length === 0 ? "opacity-100" : "opacity-0")}
            />
            <span className="truncate text-muted-foreground">{NONE_LABEL}</span>
          </button>
          {filtered.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => toggle(w.id)}
              style={{ paddingLeft: 8 + w.depth * 16 }}
              className="flex items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-accent"
            >
              <HugeiconsIcon
                icon={IconMarcado}
                size={14}
                strokeWidth={1.5}
                className={cn("shrink-0", value.includes(w.id) ? "opacity-100" : "opacity-0")}
              />
              <span className="truncate">{w.label}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
