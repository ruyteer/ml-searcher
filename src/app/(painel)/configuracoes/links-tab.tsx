"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconAlerta, IconLinks } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UrlInput } from "@/components/form/url-input";
import { Field } from "./field";
import { AlertBox } from "./alert-box";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";
import { updateAffiliateSettingsAction, updateDomainSettingsAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import type { PublicSettings } from "./types";

interface LinksTabProps {
  settings: PublicSettings;
}

/// Reimplementação leve, só para a prévia no cliente, da mesma regra de
/// src/lib/links.ts (que é server-only e não pode ser importado aqui).
function buildPreview(values: {
  publicBaseUrl: string;
  affiliateEnabled: boolean;
  affiliateTool: string;
  affiliateWord: string;
}) {
  const base =
    values.publicBaseUrl.trim().replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "https://seu-dominio.com.br");
  const trackedUrl = `${base}/r/ab12cd34`;

  let destino = "https://www.mercadolivre.com.br/produto-exemplo-MLB123456789";
  const tool = values.affiliateTool.trim();
  if (values.affiliateEnabled && tool) {
    try {
      const url = new URL(destino);
      url.searchParams.set("matt_tool", tool);
      const word = values.affiliateWord.trim();
      if (word) url.searchParams.set("matt_word", word);
      destino = url.toString();
    } catch {
      // URL de exemplo é fixa e válida — não deveria cair aqui
    }
  }

  return { trackedUrl, destino };
}

export function LinksTab({ settings }: LinksTabProps) {
  const [domain, setDomain] = useState(settings.publicBaseUrl);
  const [affiliateEnabled, setAffiliateEnabled] = useState(settings.affiliateEnabled);
  const [affiliateTool, setAffiliateTool] = useState(settings.affiliateTool);
  const [affiliateWord, setAffiliateWord] = useState(settings.affiliateWord);

  const [domainState, domainAction] = useActionState(updateDomainSettingsAction, INITIAL_ACTION_STATE);
  const [affiliateState, affiliateFormAction] = useActionState(
    updateAffiliateSettingsAction,
    INITIAL_ACTION_STATE,
  );
  useActionToast(domainState);
  useActionToast(affiliateState);

  const domainSavedRef = useRef(domain);
  const affiliateSavedRef = useRef({ affiliateEnabled, affiliateTool, affiliateWord });

  useEffect(() => {
    if (domainState.ok && domainState.ts) domainSavedRef.current = domain;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainState.ts]);

  useEffect(() => {
    if (affiliateState.ok && affiliateState.ts) {
      affiliateSavedRef.current = { affiliateEnabled, affiliateTool, affiliateWord };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliateState.ts]);

  const domainDirty = domain !== domainSavedRef.current;
  const affiliateDirty =
    JSON.stringify({ affiliateEnabled, affiliateTool, affiliateWord }) !==
    JSON.stringify(affiliateSavedRef.current);

  const preview = buildPreview({
    publicBaseUrl: domain,
    affiliateEnabled,
    affiliateTool,
    affiliateWord,
  });

  const missingTool = affiliateEnabled && !affiliateTool.trim();

  return (
    <div className="flex flex-col gap-4">
      <form action={domainAction}>
        <Section title="Domínio dos links" description="De onde saem os links curtos que o painel gera.">
          <UrlInput
            label="Domínio público"
            name="publicBaseUrl"
            placeholder="https://seudominio.com.br"
            value={domain}
            onValueChange={setDomain}
            hint="Deixe vazio para usar o domínio atual. Preencha quando apontar um domínio próprio."
            error={domainState.errors?.publicBaseUrl?.[0]}
          />
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            <SaveButton />
            {domainDirty && <span className="text-xs text-warning">Alterações não salvas</span>}
          </div>
        </Section>
      </form>

      <form action={affiliateFormAction}>
        <Section
          title="Programa de afiliados"
          description="Quando ativo, os links ganham a tag de afiliado do Mercado Livre (matt_tool / matt_word)."
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="flex flex-col">
                <Label htmlFor="affiliateEnabled">Programa de afiliados ativo</Label>
                <span className="text-xs text-muted-foreground">
                  Desligado, os links saem crus (sem tag de rastreio).
                </span>
              </div>
              <Switch
                id="affiliateEnabled"
                name="affiliateEnabled"
                value="true"
                uncheckedValue="false"
                checked={affiliateEnabled}
                onCheckedChange={setAffiliateEnabled}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Tool"
                name="affiliateTool"
                placeholder="Ex.: 88888888"
                value={affiliateTool}
                onValueChange={setAffiliateTool}
                error={affiliateState.errors?.affiliateTool?.[0]}
                tooltip="Código matt_tool do seu programa de afiliados no Mercado Livre."
              />
              <Field
                label="Word"
                name="affiliateWord"
                placeholder="Opcional"
                value={affiliateWord}
                onValueChange={setAffiliateWord}
                error={affiliateState.errors?.affiliateWord?.[0]}
                tooltip="Código matt_word opcional, para identificar a origem do link (ex.: qual grupo de WhatsApp)."
              />
            </div>

            {missingTool && (
              <AlertBox icon={IconAlerta} variant="warning">
                Programa de afiliados ligado sem a tag (tool) preenchida. Os links vão sair sem a tag de
                afiliado até você preencher esse campo.
              </AlertBox>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            <SaveButton />
            {affiliateDirty && <span className="text-xs text-warning">Alterações não salvas</span>}
          </div>
        </Section>
      </form>

      <Section title="Prévia" description="Como um link de exemplo fica com as configurações acima (ainda não salvas).">
        <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3 font-mono text-xs">
          <div className="flex items-start gap-2">
            <HugeiconsIcon icon={IconLinks} size={14} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 break-all">
              <span className="text-muted-foreground">Link curto (copiável no painel):</span>
              <span>{preview.trackedUrl}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <HugeiconsIcon icon={IconLinks} size={14} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 break-all">
              <span className="text-muted-foreground">Destino final:</span>
              <span>{preview.destino}</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
