"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Info, CheckCircle2, XCircle } from "lucide-react";
import { Section } from "@/components/shell/section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "./field";
import { AlertBox } from "./alert-box";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";
import { updateMlSettingsAction, testMlConnectionAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import type { PublicSettings } from "./types";

interface MercadoLivreTabProps {
  settings: PublicSettings;
}

/// Sites do Mercado Livre suportados pela API de client_credentials. A lista
/// em si é fixa (definida pelo próprio ML), o que muda é a escolha, salva em settings.mlSiteId.
const ML_SITES = [
  { value: "MLB", label: "MLB — Brasil" },
  { value: "MLA", label: "MLA — Argentina" },
  { value: "MLM", label: "MLM — México" },
  { value: "MCO", label: "MCO — Colômbia" },
  { value: "MLC", label: "MLC — Chile" },
  { value: "MPE", label: "MPE — Peru" },
  { value: "MLU", label: "MLU — Uruguai" },
  { value: "MEC", label: "MEC — Equador" },
];

export function MercadoLivreTab({ settings }: MercadoLivreTabProps) {
  const [clientId, setClientId] = useState(settings.mlClientId);
  const [clientSecret, setClientSecret] = useState(""); // nunca pré-preenchido
  const [showSecret, setShowSecret] = useState(false);
  const [siteId, setSiteId] = useState(settings.mlSiteId);

  const [state, formAction] = useActionState(updateMlSettingsAction, INITIAL_ACTION_STATE);
  useActionToast(state);

  const savedRef = useRef({ clientId, siteId });
  useEffect(() => {
    if (state.ok && state.ts) {
      savedRef.current = { clientId, siteId };
      setClientSecret(""); // já foi salvo, limpa o campo pra não sugerir texto puro salvo
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  const dirty = clientId !== savedRef.current.clientId || siteId !== savedRef.current.siteId || clientSecret !== "";

  const [testState, testAction] = useActionState(testMlConnectionAction, INITIAL_ACTION_STATE);

  const hasCredentials = Boolean(clientId.trim()) && settings.mlHasSecret;
  const demoMode = !hasCredentials;

  return (
    <Section
      title="Mercado Livre"
      description="Credenciais da API oficial do Mercado Livre — sem elas, o sistema roda com produtos de exemplo."
    >
      <div className="flex flex-col gap-5">
        {demoMode && (
          <AlertBox icon={Info} variant="warning" title="Modo demonstração ativo">
            <p>
              Sem credenciais preenchidas, o sistema está rodando em <b>MODO DEMONSTRAÇÃO</b>, mostrando
              produtos de exemplo em vez de ofertas reais do Mercado Livre.
            </p>
            <ol>
              <li>
                Crie uma aplicação em{" "}
                <a href="https://developers.mercadolivre.com.br" target="_blank" rel="noopener noreferrer">
                  developers.mercadolivre.com.br
                </a>
                .
              </li>
              <li>Copie o App ID e a Secret Key gerados para a sua aplicação.</li>
              <li>Cole os dois campos abaixo e salve — a próxima varredura já busca ofertas reais.</li>
            </ol>
          </AlertBox>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="App ID (Client ID)"
              name="mlClientId"
              value={clientId}
              onValueChange={setClientId}
              placeholder="Ex.: 1234567890123456"
              error={state.errors?.mlClientId?.[0]}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mlSiteId">Site</Label>
              <Select name="mlSiteId" value={siteId} onValueChange={(v) => setSiteId(v ?? "MLB")}>
                <SelectTrigger id="mlSiteId" className="w-full">
                  <SelectValue placeholder="MLB — Brasil" />
                </SelectTrigger>
                <SelectContent>
                  {ML_SITES.map((site) => (
                    <SelectItem key={site.value} value={site.value}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Padrão: MLB — Brasil.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mlClientSecret">Secret Key (Client Secret)</Label>
            <div className="relative">
              <Input
                id="mlClientSecret"
                name="mlClientSecret"
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={settings.mlHasSecret ? "•••••••• (mantém o valor salvo)" : "Cole aqui a Secret Key"}
                aria-invalid={Boolean(state.errors?.mlClientSecret?.[0])}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showSecret ? "Ocultar secret" : "Mostrar secret"}
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {state.errors?.mlClientSecret?.[0] ? (
              <p className="text-xs text-danger" role="alert">
                {state.errors.mlClientSecret[0]}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Por segurança, o valor salvo nunca é reexibido. Deixe em branco para mantê-lo como está.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <SaveButton />
            {dirty && <span className="text-xs text-warning">Alterações não salvas</span>}
          </div>
        </form>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <form action={testAction}>
            <SaveButton variant="outline" size="sm" label="Testar conexão" pendingLabel="Testando..." />
          </form>
          {testState.ts > 0 && (
            <p
              className={`flex items-center gap-1.5 text-xs ${testState.ok ? "text-success" : "text-danger"}`}
            >
              {testState.ok ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <XCircle className="size-3.5 shrink-0" />
              )}
              {testState.message}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
