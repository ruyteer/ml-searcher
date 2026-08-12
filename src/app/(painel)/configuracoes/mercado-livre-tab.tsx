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
  IconChevronBaixo,
  IconChevronCima,
  IconAbrirFora,
  IconDesvincular,
} from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field } from "./field";
import { AlertBox } from "./alert-box";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";
import {
  updateMlSettingsAction,
  testMlConnectionAction,
  updateMlRedirectUriAction,
  connectMlWithCodeAction,
  disconnectMlAction,
} from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import type { PublicSettings } from "./types";

interface MercadoLivreTabProps {
  settings: PublicSettings;
}

/// Sites do Mercado Livre. A lista é fixa (definida pelo próprio ML); o que
/// muda é a escolha, salva em settings.mlSiteId. Ela também decide o domínio
/// da tela de autorização (auth.mercadolivre.com.br para MLB).
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

const FONTE_LABEL: Record<PublicSettings["mlAuth"]["fonte"], string> = {
  usuario: "Token da conta autorizada (fluxo oficial)",
  aplicacao: "Token da aplicação (caminho legado)",
  nenhum: "Nenhum token disponível",
};

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
      setClientSecret(""); // já foi salvo, limpa o campo pra não sugerir texto puro salvo
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

  // ------------------------------------------------------------ modo manual
  const [manualOpen, setManualOpen] = useState(false);
  const [redirectUri, setRedirectUri] = useState(settings.mlRedirectUri);

  const [redirectState, redirectAction] = useActionState(
    updateMlRedirectUriAction,
    INITIAL_ACTION_STATE,
  );
  useActionToast(redirectState);

  const [connectState, connectAction] = useActionState(connectMlWithCodeAction, INITIAL_ACTION_STATE);
  useActionToast(connectState);

  // O campo do code é não-controlado: trocar a key remonta o input e limpa o
  // texto só depois de uma conexão bem-sucedida. Em caso de erro, o que foi
  // colado continua ali para o usuário corrigir.
  const codeFieldKey = connectState.ok ? connectState.ts : 0;

  const hasCredentials = Boolean(clientId.trim()) && settings.mlHasSecret;
  const demoMode = !hasCredentials;

  return (
    <Section
      title="Mercado Livre"
      description="Credenciais da aplicação e conexão com a sua conta do Mercado Livre. Sem isso, o sistema roda com produtos de exemplo."
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
                  ? `Conta ${auth.nickname ?? auth.mlUserId ?? "autorizada"}`
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

          <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Fonte do token:</dt>
              <dd className="font-medium">{FONTE_LABEL[auth.fonte]}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Token expira em:</dt>
              <dd className="font-medium">
                {auth.expiraEm ? formatDateTime(auth.expiraEm) : "sem conexão de usuário"}
              </dd>
            </div>
            {auth.mlUserId && (
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">ID da conta:</dt>
                <dd className="font-medium">{auth.mlUserId}</dd>
              </div>
            )}
            {auth.scope && (
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Permissões:</dt>
                <dd className="font-medium">{auth.scope}</dd>
              </div>
            )}
          </dl>

          <p className="text-xs text-muted-foreground">
            A renovação do token é automática: o sistema troca por um novo antes de expirar, sem você
            precisar fazer nada.
          </p>

          {auth.erro && (
            <AlertBox icon={IconAlerta} variant="danger" title="A conexão caiu">
              <p>{auth.erro}</p>
            </AlertBox>
          )}

          {!auth.conectado && auth.fonte === "aplicacao" && (
            <AlertBox icon={IconAlerta} variant="warning" title="Rodando pelo caminho legado">
              <p>
                As buscas estão usando o token da própria aplicação. Ele funciona hoje, mas não consta
                na documentação oficial do Mercado Livre e pode parar de funcionar sem aviso. Conecte
                uma conta para usar o fluxo oficial.
              </p>
            </AlertBox>
          )}
        </div>

        {demoMode && (
          <AlertBox icon={IconInfo} variant="warning" title="Modo demonstração ativo">
            <p>
              Sem credenciais preenchidas, o sistema está rodando em <b>MODO DEMONSTRAÇÃO</b>, mostrando
              produtos de exemplo em vez de ofertas reais do Mercado Livre.
            </p>
          </AlertBox>
        )}

        <AlertBox icon={IconInfo} variant="info" title="Como preparar a aplicação no Mercado Livre">
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              Crie a aplicação em{" "}
              <a href="https://developers.mercadolivre.com.br" target="_blank" rel="noopener noreferrer">
                developers.mercadolivre.com.br
              </a>
              , no menu Minhas aplicações.
            </li>
            <li>
              Cadastre a URL de redirecionamento (Redirect URI). Ela precisa ser https, o Mercado Livre
              não aceita http nem localhost.
            </li>
            <li>Copie o App ID e a Secret Key da aplicação para os campos abaixo e salve.</li>
          </ul>
        </AlertBox>

        {/* -------------------------------------------------------- credenciais */}
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
              <p className="text-xs text-muted-foreground">Padrão: MLB (Brasil).</p>
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
                Por segurança, o valor salvo nunca é reexibido. Deixe em branco para mantê-lo como está.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <SaveButton />
            {dirty && <span className="text-xs text-warning">Alterações não salvas</span>}
          </div>
        </form>

        {/* ------------------------------------------------------- modo manual */}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setManualOpen((v) => !v)}
            aria-expanded={manualOpen}
          >
            <HugeiconsIcon
              icon={manualOpen ? IconChevronCima : IconChevronBaixo}
              size={14}
              strokeWidth={1.6}
              aria-hidden="true"
            />
            Conectar colando o código na mão
          </Button>

          {manualOpen && (
            <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
              <AlertBox icon={IconInfo} variant="info" title="Quando usar isto">
                <p>
                  O Mercado Livre só aceita endereços https na URL de redirecionamento, e este painel
                  ainda roda em http://localhost. Enquanto for assim, o retorno automático não
                  funciona e a conexão é feita em 3 passos:
                </p>
                <ol>
                  <li>
                    Salve abaixo a URL de redirecionamento, exatamente a mesma que você cadastrou na
                    aplicação do Mercado Livre.
                  </li>
                  <li>
                    Clique em Abrir a tela de autorização e autorize com a sua conta. O navegador vai
                    tentar abrir aquela URL e provavelmente mostrar uma página de erro. Tudo bem, o que
                    interessa está na barra de endereço.
                  </li>
                  <li>
                    Copie o que aparece depois de <code>code=</code> na barra de endereço, cole no campo
                    abaixo e clique em Concluir conexão. O código vale por poucos minutos.
                  </li>
                </ol>
              </AlertBox>

              <form action={redirectAction} className="flex flex-col gap-3">
                <Field
                  label="URL de redirecionamento cadastrada"
                  name="mlRedirectUri"
                  value={redirectUri}
                  onValueChange={setRedirectUri}
                  placeholder="https://seu-dominio.com.br/api/ml/callback"
                  help="Precisa ser idêntica à cadastrada na aplicação, letra por letra."
                  error={redirectState.errors?.mlRedirectUri?.[0]}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <SaveButton variant="outline" size="sm" label="Salvar URL" pendingLabel="Salvando..." />
                  <a
                    href="/api/ml/auth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    <HugeiconsIcon icon={IconAbrirFora} size={14} strokeWidth={1.6} aria-hidden="true" />
                    Abrir a tela de autorização
                  </a>
                </div>
              </form>

              <form action={connectAction} className="flex flex-col gap-3 border-t border-border pt-4">
                <input type="hidden" name="mlRedirectUri" value={redirectUri} />
                <Field
                  key={codeFieldKey}
                  label="Código de autorização"
                  name="mlCode"
                  defaultValue=""
                  placeholder="TG-0000000000000000000000-000000000"
                  help="Pode colar só o código ou a URL inteira da barra de endereço."
                  error={connectState.errors?.mlCode?.[0] ?? connectState.errors?.mlRedirectUri?.[0]}
                />
                <SaveButton
                  size="sm"
                  label="Concluir conexão"
                  pendingLabel="Conectando..."
                  className="w-fit"
                />
              </form>
            </div>
          )}
        </div>

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
