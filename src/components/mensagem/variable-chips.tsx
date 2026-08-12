"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TEMPLATE_VARIABLES, type TemplateVariableName } from "@/lib/message";
import { cn } from "@/lib/utils";

export interface VariableChipsProps {
  /// Chamado com o nome da variável quando o botão correspondente é clicado.
  onInsert: (name: TemplateVariableName) => void;
  className?: string;
}

/// Barra de botões — um por variável de TEMPLATE_VARIABLES — que a fase de
/// WhatsApp também reusa em qualquer editor de template. A legenda de cada
/// variável aparece em tooltip ao passar o mouse.
export function VariableChips({ onInsert, className }: VariableChipsProps) {
  return (
    <TooltipProvider>
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {TEMPLATE_VARIABLES.map((v) => (
          <Tooltip key={v.name}>
            <TooltipTrigger
              render={
                <Button type="button" variant="outline" size="xs" onClick={() => onInsert(v.name)}>
                  {`{{${v.name}}}`}
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
