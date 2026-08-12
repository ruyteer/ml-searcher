"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckIcon, PlusSignIcon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getCategoryLabel } from "@/lib/frases-labels";

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
  const filtered = categories.filter((c) =>
    getCategoryLabel(c).toLowerCase().includes(trimmedQuery.toLowerCase()) ||
    c.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );
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
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? getCategoryLabel(value) : placeholder}
            </span>
            <HugeiconsIcon icon={UnfoldMoreIcon} size={16} strokeWidth={1.5} className="shrink-0 opacity-50" />
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
              <HugeiconsIcon
                icon={CheckIcon}
                size={14}
                strokeWidth={1.5}
                className={cn("shrink-0", value === c ? "opacity-100" : "opacity-0")}
              />
              <span className="truncate">{getCategoryLabel(c)}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => pick(trimmedQuery)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.5} className="shrink-0" />
              <span className="truncate">Criar &quot;{getCategoryLabel(trimmedQuery)}&quot;</span>
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
