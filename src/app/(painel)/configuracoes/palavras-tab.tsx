"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconAdicionar, IconAlerta, IconFechar, IconInfo } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatWordList, parseWordList, MAX_PALAVRAS } from "@/lib/word-filter";
import { previewWordFilterAction, updateWordFilterAction } from "./actions";
import { INITIAL_ACTION_STATE, PREVISAO_VAZIA, type PrevisaoDoFiltro } from "./action-state";
import { AlertBox } from "./alert-box";
import { HelpTooltip } from "./field";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";
import type { PublicSettings } from "./types";

interface PalavrasTabProps {
  settings: PublicSettings;
}

// ------------------------------------------------------------ lista de fichas

interface ListaDePalavrasProps {
  id: string;
  titulo: string;
  ajuda: React.ReactNode;
  placeholder: string;
  vazio: string;
  palavras: string[];
  onChange: (palavras: string[]) => void;
}

/// Uma das duas listas: campo que aceita colar tudo de uma vez e as palavras já
/// guardadas como fichas, cada uma removível sozinha.
function ListaDePalavras({
  id,
  titulo,
  ajuda,
  placeholder,
  vazio,
  palavras,
  onChange,
}: ListaDePalavrasProps) {
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

// ----------------------------------------------------------------------- aba

/// Quanto tempo esperamos parar de mexer antes de pedir a prévia ao servidor.
const ATRASO_PREVIA = 500;

export function PalavrasTab({ settings }: PalavrasTabProps) {
  const [excluir, setExcluir] = useState(() => parseWordList(settings.filterExcludeWords));
  const [obrigatorias, setObrigatorias] = useState(() =>
    parseWordList(settings.filterRequireWords),
  );

  const [state, formAction] = useActionState(updateWordFilterAction, INITIAL_ACTION_STATE);
  useActionToast(state);

  const excluirTexto = formatWordList(excluir);
  const obrigatoriasTexto = formatWordList(obrigatorias);

  // O aviso de "alterações não salvas" compara com o que veio do servidor. Não
  // precisa de estado nem de efeito: salvar invalida o cache das configurações,
  // a página volta com os valores novos e o aviso some sozinho.
  const salvo = useMemo(
    () => ({
      excluir: formatWordList(parseWordList(settings.filterExcludeWords)),
      obrigatorias: formatWordList(parseWordList(settings.filterRequireWords)),
    }),
    [settings.filterExcludeWords, settings.filterRequireWords],
  );

  const naoSalvo = excluirTexto !== salvo.excluir || obrigatoriasTexto !== salvo.obrigatorias;

  // Prévia do impacto: pedida ao servidor pouco depois de a pessoa parar de
  // mexer, para ela ver o estrago antes de salvar.
  const [previa, setPrevia] = useState<PrevisaoDoFiltro>(PREVISAO_VAZIA);
  const [calculando, startPrevia] = useTransition();

  useEffect(() => {
    let atual = true;
    const timer = setTimeout(() => {
      startPrevia(async () => {
        const resultado = await previewWordFilterAction(excluirTexto, obrigatoriasTexto);
        if (atual) setPrevia(resultado);
      });
    }, ATRASO_PREVIA);
    return () => {
      atual = false;
      clearTimeout(timer);
    };
  }, [excluirTexto, obrigatoriasTexto]);

  const semPalavra = excluir.length === 0 && obrigatorias.length === 0;

  const resumo = useMemo(() => {
    if (!previa.ok) return previa.message;
    if (semPalavra) return "Sem nenhuma palavra configurada, tudo continua aparecendo.";
    return (
      `${previa.produtosEscondidos} de ${previa.produtosTotal} produtos e ` +
      `${previa.ofertasEscondidas} de ${previa.ofertasTotal} ofertas deixam de aparecer.`
    );
  }, [previa, semPalavra]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="filterExcludeWords" value={excluirTexto} />
      <input type="hidden" name="filterRequireWords" value={obrigatoriasTexto} />

      <Section
        title="Filtro por palavras"
        description="Escolha por palavra o que entra e o que fica de fora do painel. Vale na hora: esconde o que já foi coletado e também impede que volte na próxima varredura."
      >
        <div className="flex flex-col gap-6">
          <ListaDePalavras
            id="palavras-excluir"
            titulo="Palavras que escondem o produto"
            placeholder="Cole a lista inteira aqui, separada por vírgula ou uma por linha. Ex.: feminino, infantil, kit"
            vazio="Nenhuma palavra por aqui. Tudo continua aparecendo."
            palavras={excluir}
            onChange={setExcluir}
            ajuda={
              <div className="flex flex-col gap-1.5">
                <p>
                  Qualquer produto com uma destas palavras no nome some das telas e não é mais
                  buscado.
                </p>
                <p>
                  A palavra é comparada inteira: &quot;gel&quot; não pega &quot;gelatina&quot;.
                  Acento não importa e plural e gênero entram junto, então &quot;feminino&quot;
                  também pega &quot;feminina&quot; e &quot;femininas&quot;.
                </p>
              </div>
            }
          />

          <div className="border-t border-border pt-6">
            <ListaDePalavras
              id="palavras-obrigatorias"
              titulo="Palavras que o produto precisa ter"
              placeholder="Cole a lista inteira aqui. Ex.: barba, cabelo, shampoo"
              vazio="Lista vazia, que é o normal: sem nenhuma palavra aqui, nada é exigido e todos os produtos passam."
              palavras={obrigatorias}
              onChange={setObrigatorias}
              ajuda={
                <div className="flex flex-col gap-1.5">
                  <p>
                    Com a lista preenchida, só aparece produto que tenha PELO MENOS UMA destas
                    palavras no nome. Não precisa ter todas.
                  </p>
                  <p>Lista vazia significa sem restrição nenhuma: todos passam.</p>
                </div>
              }
            />
          </div>

          {obrigatorias.length > 0 && (
            <AlertBox icon={IconAlerta} variant="warning" title="Atenção, esta lista é agressiva">
              <p>
                Enquanto houver palavra aqui, tudo que não tiver uma delas no nome some do painel.
                Basta uma palavra para o produto passar, mas quem não tiver nenhuma fica escondido.
              </p>
              <p>Para voltar ao normal, esvazie a lista: lista vazia não exige nada.</p>
            </AlertBox>
          )}

          <AlertBox icon={IconInfo} variant="info" title="Nada é apagado">
            <p>
              Os produtos continuam guardados. As palavras só decidem o que aparece: apague uma
              palavra, salve, e os produtos dela voltam a aparecer na hora.
            </p>
          </AlertBox>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
          <SaveButton label="Salvar palavras" pendingLabel="Salvando..." />
          {naoSalvo && <span className="text-xs text-warning">Alterações não salvas</span>}
        </div>
      </Section>

      <Section
        title="O que some com estas palavras"
        description="Conferido no catálogo de verdade, antes de você salvar."
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border px-3.5 py-3">
              <span className="text-xs text-muted-foreground">Produtos escondidos</span>
              <p className="text-2xl font-semibold tabular-nums">
                {calculando ? "..." : previa.produtosEscondidos}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  de {previa.produtosTotal}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-border px-3.5 py-3">
              <span className="text-xs text-muted-foreground">Ofertas escondidas</span>
              <p className="text-2xl font-semibold tabular-nums">
                {calculando ? "..." : previa.ofertasEscondidas}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  de {previa.ofertasTotal}
                </span>
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{calculando ? "Conferindo..." : resumo}</p>
        </div>
      </Section>
    </form>
  );
}
