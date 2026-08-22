"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShuffleIcon } from "@hugeicons/core-free-icons";
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

export interface PhrasePickerWatch {
  id: string;
  label: string;
}

export interface PhrasePickerProps {
  /// Frases já carregadas (este componente não busca no banco), para poder
  /// ser reusado tanto a partir de um Server Component quanto de um Client.
  phrases: Phrase[];
  /// Watches conhecidos, pra resolver o rótulo do grupo — Phrase só guarda o
  /// watchId (cuid).
  watches: PhrasePickerWatch[];
  onPick: (phrase: Phrase) => void;
  className?: string;
}

/// Sentinela pro grupo "Sem categoria" (watchId nulo) — o Select não aceita
/// valor vazio, então usamos essa chave interna em vez de "".
const NONE_VALUE = "__none__";

/// Escolhe uma frase de uma categoria, com botão de sortear uma aleatória
/// dentre as ativas da categoria selecionada.
export function PhrasePicker({ phrases, watches, onPick, className }: PhrasePickerProps) {
  const groupKeys = useMemo(() => [...new Set(phrases.map((p) => p.watchId ?? NONE_VALUE))], [phrases]);
  const [category, setCategory] = useState(groupKeys[0] ?? "");
  const activeCategory = groupKeys.includes(category) ? category : (groupKeys[0] ?? "");

  const labelByWatchId = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of watches) map.set(w.id, w.label);
    return map;
  }, [watches]);

  function labelFor(key: string): string {
    return key === NONE_VALUE ? "Sem categoria" : (labelByWatchId.get(key) ?? key);
  }

  const inCategory = useMemo(
    () => phrases.filter((p) => (p.watchId ?? NONE_VALUE) === activeCategory && p.active),
    [phrases, activeCategory],
  );

  function sortear() {
    if (inCategory.length === 0) return;
    onPick(inCategory[Math.floor(Math.random() * inCategory.length)]);
  }

  if (groupKeys.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>Nenhuma frase cadastrada ainda.</p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Select value={activeCategory} onValueChange={(v) => setCategory(v ?? "")}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Categoria">
              {(v: string | null) => (v ? labelFor(v) : "Categoria")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {groupKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {labelFor(key)}
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
          <HugeiconsIcon icon={ShuffleIcon} size={16} strokeWidth={1.5} />
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
