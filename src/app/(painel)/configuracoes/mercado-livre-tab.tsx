"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconVer,
  IconOcultar,
  IconInfo,
  IconSucesso,
  IconErroCirculo,
  IconAlerta,
  IconDesvincular,
} from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Field, HelpTooltip } from "./field";
import { AlertBox } from "./alert-box";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";
import { updateMlSettingsAction, testMlConnectionAction, disconnectMlAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import type { PublicSettings } from "./types";

interface MercadoLivreTabProps {
  settings: PublicSettings;
}

/// Sites do Mercado Livre. A lista é fixa (definida pelo próprio ML); o que
/// muda é a escolha, salva em settings.mlSiteId.
const ML_SITES = [
  { value: "MLB", label: "MLB (Brasil)" },
  { value: "MLA", label: "MLA (Argentina)" },
  { value: "MLM", label: "MLM (México)" },
  { value: "MCO", label: "MCO (Colômbia)" },
  { value: "MLC", label: "MLC (Chile)" },
  { value: "MPE", label: "MPE (Peru)" },
  { value: "MLU", label: "MLU (Uruguai)" },
  { value: "MEC", label: "MEC (Equador)" },
];

export function MercadoLivreTab({ settings }: MercadoLivreTabProps) {
  const auth = settings.mlAuth;

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
      setClientSecret(""); // já foi salvo, limpa o campo
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  const dirty =
    clientId !== savedRef.current.clientId || siteId !== savedRef.current.siteId || clientSecret !== "";

  const [testState, testAction] = useActionState(testMlConnectionAction, INITIAL_ACTION_STATE);

  const [disconnectState, disconnectAction] = useActionState(disconnectMlAction, INITIAL_ACTION_STATE);
  useActionToast(disconnectState);

  // ------------------------------------------------- retorno de /api/ml/callback
  const [mlResult, setMlResult] = useQueryState("ml");
  const [mlMotivo, setMlMotivo] = useQueryState("motivo");

  useEffect(() => {
    if (!mlResult) return;
    if (mlResult === "ok") {
      toast.success("Conta do Mercado Livre conectada.");
    } else {
      toast.error(mlMotivo || "Não foi possível conectar a conta do Mercado Livre.");
    }
    void setMlResult(null);
    void setMlMotivo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mlResult]);

  const hasCredentials = Boolean(clientId.trim()) && settings.mlHasSecret;
  const demoMode = !hasCredentials;

  return (
    <Section
      title="Mercado Livre"
      description="Conexão com a sua conta. Sem isso, o sistema roda com produtos de exemplo."
    >
      <div className="flex flex-col gap-5">
        {/* ---------------------------------------------------- estado da conexão */}
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant={auth.conectado ? "default" : "outline"}>
                {auth.conectado ? "Conectado" : "Não conectado"}
              </Badge>
              <span className="text-sm font-medium">
                {auth.conectado
                  ? auth.nickname
                    ? `Conta ${auth.nickname}`
                    : "Conta autorizada"
                  : "Nenhuma conta autorizada"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/api/ml/auth"
                className={cn(buttonVariants({ variant: auth.conectado ? "outline" : "default", size: "sm" }))}
              >
                {auth.conectado ? "Reconectar" : "Conectar com o Mercado Livre"}
              </a>
              {auth.conectado && (
                <form action={disconnectAction}>
                  <SaveButton variant="ghost" size="sm" label="Desconectar" pendingLabel="Desconectando...">
                    <HugeiconsIcon icon={IconDesvincular} size={14} strokeWidth={1.6} aria-hidden="true" />
                    Desconectar
                  </SaveButton>
                </form>
              )}
            </div>
          </div>

          {auth.conectado && (
            <p className="text-xs text-muted-foreground">A conexão se renova sozinha, sem você precisar fazer nada.</p>
          )}

          {auth.erro && (
            <AlertBox icon={IconAlerta} variant="danger" title="A conexão caiu">
              <p>{auth.erro}</p>
            </AlertBox>
          )}

          {!auth.conectado && auth.fonte === "aplicacao" && (
            <AlertBox icon={IconAlerta} variant="warning">
              <p>Funcionando com a credencial da aplicação. Conecte sua conta acima para o modo oficial.</p>
            </AlertBox>
          )}
        </div>

        {demoMode && (
          <AlertBox icon={IconInfo} variant="warning" title="Modo demonstração ativo">
            <p>
              Sem credenciais preenchidas, o sistema mostra produtos de exemplo em vez de ofertas reais do
              Mercado Livre.
            </p>
          </AlertBox>
        )}

        <p className="text-xs text-muted-foreground">
          Crie a aplicação em{" "}
          <a
            href="https://developers.mercadolivre.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            developers.mercadolivre.com.br
          </a>{" "}
          e cole o App ID e a Secret Key dela abaixo.
        </p>

        {/* -------------------------------------------------------- credenciais */}
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="App ID"
              name="mlClientId"
              value={clientId}
              onValueChange={setClientId}
              placeholder="Ex.: 1234567890123456"
              error={state.errors?.mlClientId?.[0]}
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="mlSiteId">Site</Label>
                <HelpTooltip label="Site">
                  País de atuação da sua conta no Mercado Livre. Padrão: MLB (Brasil).
                </HelpTooltip>
              </div>
              <Select name="mlSiteId" value={siteId} onValueChange={(v) => setSiteId(v ?? "MLB")}>
                <SelectTrigger id="mlSiteId" className="w-full">
                  <SelectValue placeholder="MLB (Brasil)" />
                </SelectTrigger>
                <SelectContent>
                  {ML_SITES.map((site) => (
                    <SelectItem key={site.value} value={site.value}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mlClientSecret">Secret Key</Label>
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
                aria-label={showSecret ? "Ocultar Secret Key" : "Mostrar Secret Key"}
              >
                {showSecret ? (
                  <HugeiconsIcon icon={IconOcultar} size={16} strokeWidth={1.6} aria-hidden="true" />
                ) : (
                  <HugeiconsIcon icon={IconVer} size={16} strokeWidth={1.6} aria-hidden="true" />
                )}
              </button>
            </div>
            {state.errors?.mlClientSecret?.[0] ? (
              <p className="text-xs text-danger" role="alert">
                {state.errors.mlClientSecret[0]}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                O valor salvo nunca é reexibido. Deixe em branco para mantê-lo como está.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <SaveButton />
            {dirty && <span className="text-xs text-warning">Alterações não salvas</span>}
          </div>
        </form>

        {/* ---------------------------------------------------- testar conexão */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <form action={testAction}>
            <SaveButton variant="outline" size="sm" label="Testar conexão" pendingLabel="Testando..." />
          </form>
          {testState.ts > 0 && (
            <p
              className={`flex items-center gap-1.5 text-xs ${testState.ok ? "text-success" : "text-danger"}`}
            >
              {testState.ok ? (
                <HugeiconsIcon icon={IconSucesso} size={14} strokeWidth={1.6} className="shrink-0" aria-hidden="true" />
              ) : (
                <HugeiconsIcon icon={IconErroCirculo} size={14} strokeWidth={1.6} className="shrink-0" aria-hidden="true" />
              )}
              {testState.message}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
