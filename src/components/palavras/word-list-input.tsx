"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconAdicionar, IconFechar } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HelpTooltip } from "@/app/(painel)/configuracoes/field";
import { formatWordList, parseWordList, MAX_PALAVRAS } from "@/lib/word-filter";

interface WordListInputProps {
  id: string;
  titulo: string;
  ajuda: React.ReactNode;
  placeholder: string;
  vazio: string;
  palavras: string[];
  onChange: (palavras: string[]) => void;
}

/// Campo que aceita colar tudo de uma vez e as palavras já guardadas como
/// fichas, cada uma removível sozinha. Compartilhado entre a aba de
/// configurações e os diálogos que precisam de uma lista de palavras.
export function WordListInput({
  id,
  titulo,
  ajuda,
  placeholder,
  vazio,
  palavras,
  onChange,
}: WordListInputProps) {
  const [rascunho, setRascunho] = useState("");
  const cheia = palavras.length >= MAX_PALAVRAS;

  function adicionar() {
    const novas = parseWordList(rascunho);
    if (novas.length === 0) {
      setRascunho("");
      return;
    }
    // O parseWordList já tira repetida e vazia olhando a forma sem acento, e é
    // ele mesmo que decide o que fica quando a junção passa do teto.
    onChange(parseWordList(formatWordList([...palavras, ...novas])));
    setRascunho("");
  }

  function remover(palavra: string) {
    onChange(palavras.filter((p) => p !== palavra));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{titulo}</Label>
        <HelpTooltip label={titulo}>{ajuda}</HelpTooltip>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          id={id}
          rows={2}
          className="sm:flex-1"
          placeholder={placeholder}
          value={rascunho}
          disabled={cheia}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={adicionar}
          disabled={cheia || rascunho.trim() === ""}
        >
          <HugeiconsIcon icon={IconAdicionar} size={14} strokeWidth={1.8} aria-hidden="true" />
          Adicionar
        </Button>
      </div>

      {cheia && (
        <span className="text-xs text-warning">
          A lista chegou ao limite de {MAX_PALAVRAS} palavras. Remova alguma para incluir outra.
        </span>
      )}

      {palavras.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {palavras.map((palavra) => (
            <Badge key={palavra} variant="outline" className="h-6 gap-1 pr-1 pl-2.5">
              <span className="truncate">{palavra}</span>
              <button
                type="button"
                aria-label={`Remover a palavra ${palavra}`}
                onClick={() => remover(palavra)}
                className="-mr-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <HugeiconsIcon icon={IconFechar} size={11} strokeWidth={2} aria-hidden="true" />
              </button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange([])}
          >
            Limpar tudo
          </Button>
        </div>
      )}
    </div>
  );
}
