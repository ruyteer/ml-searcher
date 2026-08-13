"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Section } from "@/components/shell/section";
import { IconInfo } from "@/components/icons";
import { formatBRL } from "@/lib/format";
import { centsToMasked, moneyToCents } from "@/lib/mask";
import { PercentInput } from "@/components/form/percent-input";
import { IntegerInput } from "@/components/form/integer-input";
import { MoneyInput } from "@/components/form/money-input";
import { previewDetectionAction, updateDetectionSettingsAction } from "./actions";
import {
  INITIAL_ACTION_STATE,
  PREVISAO_DETECCAO_VAZIA,
  type PrevisaoDaDeteccao,
} from "./action-state";
import { AlertBox } from "./alert-box";
import { useActionToast } from "./use-action-toast";
import { SaveButton } from "./save-button";
import { FieldWithHelp } from "./field";
import type { PublicSettings } from "./types";

interface DeteccaoTabProps {
  settings: PublicSettings;
  /// Defaults vêm de SETTINGS_SCHEMA (fonte da verdade), lidos no server component.
  defaults: {
    minDiscount: number;
    hotDiscount: number;
    minHistoryPoints: number;
    minPrice: number; // centavos
    minSoldQuantity: number;
  };
}

function valuesFrom(settings: PublicSettings) {
  return {
    minDiscount: String(settings.minDiscount),
    hotDiscount: String(settings.hotDiscount),
    minHistoryPoints: String(settings.minHistoryPoints),
    minPrice: centsToMasked(settings.minPrice),
    minSoldQuantity: String(settings.minSoldQuantity),
  };
}

function inteiro(texto: string): number {
  const n = Number(texto);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/// Quanto tempo esperamos parar de mexer antes de pedir a prévia ao servidor.
/// Mesmo ritmo da aba de palavras, pra sensação ser a mesma.
const ATRASO_PREVIA = 500;

// ------------------------------------------------------------------- números

interface CaixaDeNumeroProps {
  titulo: string;
  valor: number;
  de?: number;
  carregando: boolean;
}

function CaixaDeNumero({ titulo, valor, de, carregando }: CaixaDeNumeroProps) {
  return (
    <div className="rounded-lg border border-border px-3.5 py-3">
      <span className="text-xs text-muted-foreground">{titulo}</span>
      <p className="text-2xl font-semibold tabular-nums">
        {carregando ? "..." : valor}
        {de !== undefined && (
          <span className="text-sm font-normal text-muted-foreground"> de {de}</span>
        )}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------- aba

export function DeteccaoTab({ settings, defaults }: DeteccaoTabProps) {
  const [state, formAction] = useActionState(updateDetectionSettingsAction, INITIAL_ACTION_STATE);
  useActionToast(state);

  const [values, setValues] = useState(valuesFrom(settings));

  // O aviso de "alterações não salvas" compara com o que veio do servidor, do
  // mesmo jeito que a aba de palavras: salvar invalida o cache das
  // configurações, a página volta com os valores novos e o aviso some sozinho.
  const salvo = useMemo(() => valuesFrom(settings), [settings]);
  const dirty = JSON.stringify(values) !== JSON.stringify(salvo);
  const err = (key: string) => state.errors?.[key]?.[0];
  const set = (key: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [key]: v }));

  // Os quatro números que decidem o que APARECE. O tempo de histórico fica de
  // fora de propósito: ele só vale na próxima varredura.
  const minDiscount = inteiro(values.minDiscount);
  const hotDiscount = inteiro(values.hotDiscount);
  const minPrice = moneyToCents(values.minPrice);
  const minSoldQuantity = inteiro(values.minSoldQuantity);

  // Prévia do efeito: pedida ao servidor pouco depois de a pessoa parar de
  // mexer, para ela ver o que some antes de salvar.
  const [previa, setPrevia] = useState<PrevisaoDaDeteccao>(PREVISAO_DETECCAO_VAZIA);
  const [jaConferiu, setJaConferiu] = useState(false);
  const [calculando, startPrevia] = useTransition();

  useEffect(() => {
    let atual = true;
    const timer = setTimeout(() => {
      startPrevia(async () => {
        const resultado = await previewDetectionAction({
          minDiscount,
          hotDiscount,
          minPrice,
          minSoldQuantity,
        });
        if (!atual) return;
        setPrevia(resultado);
        setJaConferiu(true);
      });
    }, ATRASO_PREVIA);
    return () => {
      atual = false;
      clearTimeout(timer);
    };
  }, [minDiscount, hotDiscount, minPrice, minSoldQuantity]);

  // Enquanto a primeira conferência não volta, os números ainda são zero e
  // mostrá-los diria uma mentira. Melhor continuar dizendo "Conferindo...".
  const conferindo = calculando || !jaConferiu;

  const resumo = useMemo(() => {
    if (!previa.ok) return previa.message;
    if (previa.total === 0) return "Ainda não há oferta guardada para comparar.";

    const partes = [
      previa.escondidas === 0
        ? `Com ${minDiscount}% de desconto mínimo, todas as ${previa.total} ofertas continuam aparecendo.`
        : `Com ${minDiscount}% de desconto mínimo, ${previa.visiveis} de ${previa.total} ofertas continuam aparecendo e ${previa.escondidas} ficam escondidas.`,
    ];
    if (previa.imperdiveis > 0) {
      partes.push(
        `${previa.imperdiveis} delas aparecem com o destaque de imperdível (${hotDiscount}% ou mais).`,
      );
    }
    return partes.join(" ");
  }, [previa, minDiscount, hotDiscount]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Section
        title="Detecção de ofertas"
        description="Define o que é uma oferta boa o bastante. Vale na hora: muda o que aparece nas telas e também o que a próxima varredura vai procurar."
      >
        <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
          <FieldWithHelp
            label="Desconto mínimo"
            help={
              <div className="flex flex-col gap-1.5">
                <p>
                  Só aparece a oferta que estiver pelo menos esse percentual abaixo da referência de
                  preço.
                </p>
                <p>
                  Vale também para as ofertas já encontradas antes: subir o valor esconde as
                  menores, baixar traz todas de volta. Nenhuma é apagada.
                </p>
              </div>
            }
          >
            <PercentInput
              label="Desconto mínimo"
              defaultText={`Padrão: ${defaults.minDiscount}%`}
              name="minDiscount"
              value={values.minDiscount}
              onValueChange={set("minDiscount")}
              error={err("minDiscount")}
            />
          </FieldWithHelp>
          <FieldWithHelp
            label='Desconto "imperdível"'
            help={
              <div className="flex flex-col gap-1.5">
                <p>A partir deste percentual a oferta ganha o destaque de imperdível.</p>
                <p>
                  O destaque segue sempre o valor de agora, inclusive nas ofertas encontradas há
                  dias.
                </p>
              </div>
            }
          >
            <PercentInput
              label='Desconto "imperdível"'
              defaultText={`Padrão: ${defaults.hotDiscount}%`}
              name="hotDiscount"
              value={values.hotDiscount}
              onValueChange={set("hotDiscount")}
              error={err("hotDiscount")}
            />
          </FieldWithHelp>
          <FieldWithHelp
            label="Pontos mínimos de histórico"
            help={
              <div className="flex flex-col gap-1.5">
                <p>
                  Quantas varreduras o produto precisa ter pro histórico contar como referência de
                  preço.
                </p>
                <p>
                  Este é o único campo daqui que vale só da próxima varredura em diante: as ofertas
                  já encontradas mantêm a referência com que foram detectadas.
                </p>
              </div>
            }
          >
            <IntegerInput
              label="Pontos mínimos de histórico"
              defaultText={`Padrão: ${defaults.minHistoryPoints}`}
              name="minHistoryPoints"
              min={1}
              max={50}
              value={values.minHistoryPoints}
              onValueChange={set("minHistoryPoints")}
              error={err("minHistoryPoints")}
            />
          </FieldWithHelp>
          <FieldWithHelp
            label="Preço mínimo"
            help={
              <div className="flex flex-col gap-1.5">
                <p>Esconde ofertas de produtos abaixo deste preço, evitando lixo de R$ 1.</p>
                <p>Vale para as que já estão guardadas também. Baixe o valor e elas voltam.</p>
              </div>
            }
          >
            <MoneyInput
              label="Preço mínimo"
              defaultText={`Padrão: ${formatBRL(defaults.minPrice)}`}
              name="minPrice"
              min={0}
              value={values.minPrice}
              onValueChange={set("minPrice")}
              error={err("minPrice")}
            />
          </FieldWithHelp>
          <FieldWithHelp
            label="Vendas mínimas"
            help={
              <div className="flex flex-col gap-1.5">
                <p>Esconde produtos com menos vendas do que isso, e a varredura também os ignora.</p>
                <p>Com 0, não filtra por vendas.</p>
              </div>
            }
          >
            <IntegerInput
              label="Vendas mínimas"
              defaultText={`Padrão: ${defaults.minSoldQuantity}`}
              name="minSoldQuantity"
              min={0}
              value={values.minSoldQuantity}
              onValueChange={set("minSoldQuantity")}
              error={err("minSoldQuantity")}
            />
          </FieldWithHelp>
        </div>

        <div className="mt-6">
          <AlertBox icon={IconInfo} variant="info" title="Nada é apagado">
            <p>
              As ofertas escondidas continuam guardadas, com o histórico de preço completo. Baixe o
              desconto mínimo, salve, e elas voltam a aparecer na hora.
            </p>
          </AlertBox>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
          <SaveButton />
          {dirty && <span className="text-xs text-warning">Alterações não salvas</span>}
        </div>
      </Section>

      <Section
        title="O que aparece com esta configuração"
        description="Conferido nas ofertas de verdade, antes de você salvar."
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <CaixaDeNumero
              titulo="Ofertas visíveis"
              valor={previa.visiveis}
              de={previa.total}
              carregando={conferindo}
            />
            <CaixaDeNumero
              titulo="Ofertas escondidas"
              valor={previa.escondidas}
              de={previa.total}
              carregando={conferindo}
            />
            <CaixaDeNumero
              titulo="Marcadas como imperdíveis"
              valor={previa.imperdiveis}
              carregando={conferindo}
            />
          </div>
          <p className="text-sm text-muted-foreground">{conferindo ? "Conferindo..." : resumo}</p>
        </div>
      </Section>
    </form>
  );
}
