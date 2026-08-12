"use client";

import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { VariableChips } from "./variable-chips";
import { extractUnknownVariables, type TemplateVariableName } from "@/lib/message";
import { cn } from "@/lib/utils";

export interface TemplateEditorProps {
  name: string;
  body: string;
  onNameChange: (name: string) => void;
  onBodyChange: (body: string) => void;
  nameLabel?: string;
  bodyLabel?: string;
  disabled?: boolean;
  className?: string;
}

/// Editor de template: nome + corpo, com barra de botões que insere
/// {{variavel}} na posição do cursor e aviso quando o corpo usa uma
/// variável fora de TEMPLATE_VARIABLES. Não sabe nada de Server Actions —
/// é um componente controlado, reusável pela fase de WhatsApp.
export function TemplateEditor({
  name,
  body,
  onNameChange,
  onBodyChange,
  nameLabel = "Nome do template",
  bodyLabel = "Corpo da mensagem",
  disabled,
  className,
}: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: TemplateVariableName) {
    const token = `{{${variable}}}`;
    const el = textareaRef.current;
    if (!el) {
      onBodyChange(`${body}${token}`);
      return;
    }

    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    onBodyChange(next);

    // devolve o foco pro textarea e posiciona o cursor logo após o token —
    // sem isso o usuário perde o lugar onde estava digitando.
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  const unknownVars = extractUnknownVariables(body);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-editor-name">{nameLabel}</Label>
        <Input
          id="template-editor-name"
          name="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          maxLength={100}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="template-editor-body">{bodyLabel}</Label>
        </div>
        <VariableChips onInsert={insertVariable} />
        <Textarea
          id="template-editor-body"
          name="body"
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          disabled={disabled}
          rows={12}
          className="font-mono text-sm"
          required
        />
      </div>

      {unknownVars.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning">
          <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>
            Variável desconhecida: {unknownVars.map((v) => `{{${v}}}`).join(", ")}. Ela não será
            substituída ao enviar.
          </span>
        </div>
      )}
    </div>
  );
}
