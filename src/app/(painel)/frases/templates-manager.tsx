"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CopyPlus, Plus, Star, Trash2 } from "lucide-react";
import { Section } from "@/components/shell/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TemplateEditor } from "@/components/mensagem/template-editor";
import { MessagePreview } from "@/components/mensagem/message-preview";
import { PhrasePicker } from "@/components/mensagem/phrase-picker";
import { buildMessageVars, renderTemplate } from "@/lib/message";
import { cn } from "@/lib/utils";
import type { MessageTemplate, Phrase } from "@/generated/prisma";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  setDefaultTemplate,
  updateTemplate,
} from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";

export interface TemplatesManagerProps {
  templates: MessageTemplate[];
  phrases: Phrase[];
}

/// Dados fictícios pra o preview ficar realista mesmo sem uma oferta real
/// selecionada — só a frase é trocável via PhrasePicker.
const PREVIEW_SAMPLE = {
  titulo: "Máquina de Cortar Cabelo Profissional",
  precoCents: 8990,
  precoAntigoCents: 14990,
  desconto: 40,
  link: "https://exemplo.com/r/abc123",
};

export function TemplatesManager({ templates, phrases }: TemplatesManagerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? null,
  );
  // null = modo "novo template" (nenhum item da lista selecionado)
  const selected = selectedId ? (templates.find((t) => t.id === selectedId) ?? null) : null;
  const [isPending, startTransition] = useTransition();

  function handleDuplicate(id: string) {
    startTransition(async () => {
      const res = await duplicateTemplate(id);
      if (res.success) toast.success(res.message ?? "Template duplicado.");
      else toast.error(res.message ?? "Erro ao duplicar.");
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const res = await setDefaultTemplate(id);
      if (res.success) toast.success(res.message ?? "Template padrão atualizado.");
      else toast.error(res.message ?? "Erro ao definir o padrão.");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteTemplate(id);
      if (res.success) {
        toast.success(res.message ?? "Template excluído.");
        if (selectedId === id) setSelectedId(null);
      } else {
        toast.error(res.message ?? "Erro ao excluir.");
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Section title="Templates" description={`${templates.length} template(s)`}>
        <div className="flex flex-col gap-1">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                selected?.id === t.id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              {t.isDefault && (
                <Badge variant="secondary" className="shrink-0">
                  padrão
                </Badge>
              )}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("mt-3 w-full", selected === null && "border-primary text-primary")}
          onClick={() => setSelectedId(null)}
        >
          <Plus className="size-3.5" />
          Novo template
        </Button>
      </Section>

      {/* key força remontar o painel ao trocar de template (ou entrar em modo
          "novo") — reseta o editor sem precisar sincronizar via effect. */}
      <TemplateEditorPanel
        key={selected?.id ?? "new"}
        selected={selected}
        phrases={phrases}
        totalTemplates={templates.length}
        actionPending={isPending}
        onDuplicate={handleDuplicate}
        onSetDefault={handleSetDefault}
        onDelete={handleDelete}
      />
    </div>
  );
}

interface TemplateEditorPanelProps {
  selected: MessageTemplate | null;
  phrases: Phrase[];
  totalTemplates: number;
  /// true enquanto duplicar/definir padrão/excluir está em andamento.
  actionPending: boolean;
  onDuplicate: (id: string) => void;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
}

function TemplateEditorPanel({
  selected,
  phrases,
  totalTemplates,
  actionPending,
  onDuplicate,
  onSetDefault,
  onDelete,
}: TemplateEditorPanelProps) {
  const [name, setName] = useState(selected?.name ?? "");
  const [body, setBody] = useState(selected?.body ?? "");
  const [previewFrase, setPreviewFrase] = useState<string | undefined>(undefined);

  const [state, formAction, formPending] = useActionState(
    selected ? updateTemplate : createTemplate,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (state === INITIAL_ACTION_STATE) return;
    if (state.success) toast.success(state.message ?? "Salvo.");
    else if (state.message) toast.error(state.message);
  }, [state]);

  const previewBody = useMemo(() => {
    const vars = buildMessageVars({ ...PREVIEW_SAMPLE, frase: previewFrase ?? "🔥 ACHADO DO DIA" });
    return renderTemplate(body, vars);
  }, [body, previewFrase]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title={selected ? "Editar template" : "Novo template"}>
        <form action={formAction} className="flex flex-col gap-3">
          {selected && <input type="hidden" name="id" value={selected.id} />}
          <TemplateEditor
            name={name}
            body={body}
            onNameChange={setName}
            onBodyChange={setBody}
            disabled={formPending}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1">
              {selected && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDuplicate(selected.id)}
                    disabled={actionPending}
                    aria-label="Duplicar"
                    title="Duplicar"
                  >
                    <CopyPlus className="size-3.5" />
                  </Button>
                  {!selected.isDefault && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onSetDefault(selected.id)}
                      disabled={actionPending}
                      aria-label="Definir como padrão"
                      title="Definir como padrão"
                    >
                      <Star className="size-3.5" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={actionPending || totalTemplates <= 1}
                          aria-label="Excluir"
                          title={totalTemplates <= 1 ? "Não é possível excluir o último template" : "Excluir"}
                        />
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &quot;{selected.name}&quot; será removido. Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(selected.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
            <Button type="submit" size="sm" disabled={formPending}>
              {formPending ? "Salvando..." : selected ? "Salvar alterações" : "Criar template"}
            </Button>
          </div>
        </form>
      </Section>

      <div className="flex flex-col gap-4">
        <Section title="Preview ao vivo" description="Como a mensagem chega no grupo">
          <MessagePreview body={previewBody} />
        </Section>
        <Section title="Frase de exemplo" description="Troque a frase usada no preview">
          <PhrasePicker phrases={phrases} onPick={(p: Phrase) => setPreviewFrase(p.text)} />
        </Section>
      </div>
    </div>
  );
}
