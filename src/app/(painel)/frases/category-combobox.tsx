"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
  className?: string;
}

/// Combobox de categoria: escolhe uma já existente na lista ou digita uma
/// nova (categoria é só texto livre no banco — "nova" é digitar e confirmar).
export function CategoryCombobox({
  value,
  onChange,
  categories,
  placeholder = "Categoria",
  className,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const filtered = categories.filter((c) => c.toLowerCase().includes(trimmedQuery.toLowerCase()));
  const canCreate =
    trimmedQuery.length > 0 && !categories.some((c) => c.toLowerCase() === trimmedQuery.toLowerCase());

  function pick(category: string) {
    onChange(category);
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
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-64 p-1.5" align="start">
        <Input
          autoFocus
          placeholder="Buscar ou criar categoria..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-1.5"
        />
        <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <Check className={cn("size-3.5 shrink-0", value === c ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{c}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => pick(trimmedQuery)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="truncate">Criar &quot;{trimmedQuery}&quot;</span>
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma categoria.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
