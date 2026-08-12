"use client";

import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Phrase } from "@/generated/prisma";

export interface PhrasePickerProps {
  /// Frases já carregadas (este componente não busca no banco), para poder
  /// ser reusado tanto a partir de um Server Component quanto de um Client.
  phrases: Phrase[];
  onPick: (phrase: Phrase) => void;
  className?: string;
}

/// Escolhe uma frase de uma categoria, com botão de sortear uma aleatória
/// dentre as ativas da categoria selecionada.
export function PhrasePicker({ phrases, onPick, className }: PhrasePickerProps) {
  const categories = useMemo(() => [...new Set(phrases.map((p) => p.category))], [phrases]);
  const [category, setCategory] = useState(categories[0] ?? "");
  const activeCategory = categories.includes(category) ? category : (categories[0] ?? "");

  const inCategory = useMemo(
    () => phrases.filter((p) => p.category === activeCategory && p.active),
    [phrases, activeCategory],
  );

  function sortear() {
    if (inCategory.length === 0) return;
    onPick(inCategory[Math.floor(Math.random() * inCategory.length)]);
  }

  if (categories.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>Nenhuma frase cadastrada ainda.</p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Select value={activeCategory} onValueChange={(v) => setCategory(v ?? "")}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={sortear}
          disabled={inCategory.length === 0}
          title="Sortear frase"
          aria-label="Sortear frase"
        >
          <Shuffle className="size-4" />
        </Button>
      </div>
      <ScrollArea className="h-32 rounded-lg border border-border">
        <div className="flex flex-col gap-0.5 p-1.5">
          {inCategory.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
            >
              {p.text}
            </button>
          ))}
          {inCategory.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Nenhuma frase ativa nesta categoria.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
