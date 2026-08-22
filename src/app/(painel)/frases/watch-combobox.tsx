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
  /// watchId escolhido, ou null para "Sem categoria".
  value: string | null;
  onChange: (value: string | null) => void;
  watches: WatchComboboxOption[];
  className?: string;
}

/// Combobox buscável de categoria (Watch): agora só escolhe entre categorias
/// reais — criar categoria nova é coisa da aba "Categorias monitoradas", não
/// mais texto livre digitado aqui. "Sem categoria" fica fixa no topo,
/// representando `watchId = null`. Indenta cada opção por `depth`, mesma
/// convenção da árvore de categorias em Configurações.
export function WatchCombobox({ value, onChange, watches, className }: WatchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (trimmedQuery ? watches.filter((w) => w.label.toLowerCase().includes(trimmedQuery)) : watches),
    [watches, trimmedQuery],
  );

  const selectedLabel = value ? (watches.find((w) => w.id === value)?.label ?? NONE_LABEL) : NONE_LABEL;

  function pick(id: string | null) {
    onChange(id);
    setQuery("");
    setOpen(false);
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
            <span className={cn("truncate", value === null && "text-muted-foreground")}>{selectedLabel}</span>
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
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex items-center gap-2 rounded-md border-b border-border px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <HugeiconsIcon
              icon={IconMarcado}
              size={14}
              strokeWidth={1.5}
              className={cn("shrink-0", value === null ? "opacity-100" : "opacity-0")}
            />
            <span className="truncate text-muted-foreground">{NONE_LABEL}</span>
          </button>
          {filtered.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => pick(w.id)}
              style={{ paddingLeft: 8 + w.depth * 16 }}
              className="flex items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-accent"
            >
              <HugeiconsIcon
                icon={IconMarcado}
                size={14}
                strokeWidth={1.5}
                className={cn("shrink-0", value === w.id ? "opacity-100" : "opacity-0")}
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
