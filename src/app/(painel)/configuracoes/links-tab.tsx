"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconAlerta, IconLinks } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UrlInput } from "@/components/form/url-input";
import { Field } from "./field";
import { AlertBox } from "./alert-box";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";
import {
  updateAffiliateSessionAction,
  updateAffiliateSettingsAction,
  updateDomainSettingsAction,
} from "./actions";
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

/// dd/mm/aaaa hh:mm, sem depender de Intl com timezone (o servidor já manda
/// a data em UTC-3 implícito o bastante pra esta tela informativa).
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LinksTab({ settings }: LinksTabProps) {
  const [domain, setDomain] = useState(settings.publicBaseUrl);
  const [affiliateEnabled, setAffiliateEnabled] = useState(settings.affiliateEnabled);
  const [affiliateTool, setAffiliateTool] = useState(settings.affiliateTool);
  const [affiliateWord, setAffiliateWord] = useState(settings.affiliateWord);
  const [sessionCurl, setSessionCurl] = useState("");

  const [domainState, domainAction] = useActionState(updateDomainSettingsAction, INITIAL_ACTION_STATE);
  const [affiliateState, affiliateFormAction] = useActionState(
    updateAffiliateSettingsAction,
    INITIAL_ACTION_STATE,
  );
  const [sessionState, sessionFormAction] = useActionState(
    updateAffiliateSessionAction,
    INITIAL_ACTION_STATE,
  );
  useActionToast(domainState);
  useActionToast(affiliateState);
  useActionToast(sessionState);

  // Limpa a caixa depois de salvar — o curl colado nunca fica exibido de
  // volta (mesma regra do secret do Mercado Livre: nunca reexibir segredo).
  useEffect(() => {
    if (sessionState.ok && sessionState.ts) setSessionCurl("");
  }, [sessionState.ts, sessionState.ok]);

  const session = settings.affiliateSession;
  const now = Date.now();
  const expired = Boolean(session.expiresAt && new Date(session.expiresAt).getTime() <= now);
  const sessionProblem = session.invalid || expired;

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

      <form action={sessionFormAction}>
        <Section
          title="Verificação de elegibilidade"
          description="Nem todo produto é aceito pelo programa de afiliados do Mercado Livre. Com uma sessão logada aqui, o sistema confere aos poucos as ofertas encontradas e tira da lista as que forem rejeitadas — automaticamente, sem gastar chamada demais nem parecer robô."
        >
          <div className="flex flex-col gap-4">
            {session.configured && (
              <AlertBox
                icon={IconAlerta}
                variant={sessionProblem ? "danger" : "success"}
                title={sessionProblem ? "Sessão expirada" : "Sessão ativa"}
              >
                {sessionProblem ? (
                  <p>Cole um curl novo abaixo — enquanto isso, a verificação fica pausada.</p>
                ) : session.expiresAt ? (
                  <p>Válida até {formatDateTime(session.expiresAt)}.</p>
                ) : (
                  <p>Sem data de validade conhecida. Se a verificação parar de funcionar, cole um curl novo.</p>
                )}
              </AlertBox>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="curl">Curl da sessão</Label>
              <Textarea
                id="curl"
                name="curl"
                placeholder="Cole aqui o curl copiado do devtools (Network > createLink > Copy as cURL)"
                value={sessionCurl}
                onChange={(e) => setSessionCurl(e.target.value)}
                className="min-h-28 font-mono text-xs"
                aria-invalid={Boolean(sessionState.errors?.curl?.[0])}
              />
              {sessionState.errors?.curl?.[0] && (
                <p className="text-xs text-danger" role="alert">
                  {sessionState.errors.curl[0]}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                No painel de afiliados do Mercado Livre (mercadolivre.com.br/afiliados/hub), abra o
                devtools, gere um link de teste, encontre a chamada <code>createLink</code> na aba Network e
                clique em Copy → <strong>Copy as cURL (bash)</strong> — não a variante cmd/PowerShell, o
                formato é diferente e não é reconhecido aqui. O sistema extrai o cookie e o token sozinho;
                nada disso fica visível de volta nesta caixa depois de salvar.
              </p>
            </div>

            <AlertBox icon={IconAlerta} variant="warning" title="Isso é a sua sessão pessoal, não uma chave de API">
              <p>
                Diferente do App ID/Secret do Mercado Livre, esse cookie dá acesso de navegação à sua conta
                real (o mesmo que abrir o site já logado) — não dá pra revogar só o acesso do sistema, só
                deslogando a sessão ou trocando a senha na sua conta do ML. Fica guardado sem criptografia
                no banco, junto com as outras credenciais do painel: qualquer coisa com acesso de leitura ao
                banco consegue ler esse valor.
              </p>
            </AlertBox>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            <SaveButton />
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
