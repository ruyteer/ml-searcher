"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { IconAlerta } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PRESELL_VARIABLES,
  unknownPresellVariables,
  type PresellVariableName,
} from "./presell-template";

interface PresellVariableChipsProps {
  onInsert: (name: PresellVariableName) => void;
  /// Quais variáveis fazem sentido neste campo. Sem isso, mostra todas menos
  /// a foto, que só serve no campo de imagem.
  only?: PresellVariableName[];
  className?: string;
}

/// Mesma ideia dos botões do editor de mensagens: um botão por dado do
/// produto, que escreve o marcador na posição do cursor.
export function PresellVariableChips({ onInsert, only, className }: PresellVariableChipsProps) {
  const list = only
    ? PRESELL_VARIABLES.filter((v) => only.includes(v.name))
    : PRESELL_VARIABLES.filter((v) => v.name !== "imagem");

  return (
    <TooltipProvider>
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <span className="text-xs text-muted-foreground">Puxar do produto:</span>
        {list.map((v) => (
          <Tooltip key={v.name}>
            <TooltipTrigger
              render={
                <Button type="button" variant="outline" size="xs" onClick={() => onInsert(v.name)}>
                  {v.label}
                </Button>
              }
            />
            <TooltipContent>{v.description}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/// Aviso de marcador escrito errado, para o usuário não publicar uma página
/// com um buraco no lugar do dado.
export function UnknownVariableWarning({ text }: { text: string }) {
  const unknown = unknownPresellVariables(text);
  if (unknown.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning">
      <HugeiconsIcon icon={IconAlerta} size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Não existe {unknown.map((v) => `{{${v}}}`).join(", ")}. Esse pedaço vai sair em branco na
        página. Use os botões acima.
      </span>
    </div>
  );
}
