"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconWhatsapp,
  IconSucesso,
  IconAlerta,
  IconCarregando,
  IconDesvincular,
  IconLigar,
} from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInstanceAction, reconnectAction, disconnectAction } from "./actions";
import { INITIAL_INSTANCE_STATE } from "./action-state";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";
import { AlertBox } from "./alert-box";

export interface InstanceCardProps {
  instance: { id: string; name: string; status: string; lastSync: string | null } | null;
  hostConfigured: boolean;
}

type LiveStatus = "disconnected" | "connecting" | "connected" | "hibernated";

const STATUS_LABEL: Record<LiveStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando...",
  connected: "Conectado",
  hibernated: "Hibernada",
};

const POLL_MS = 3000;
const MAX_ATTEMPTS = 45; // ~2min15, cobre a janela de 2min do QR da Uazapi

interface StatusPayload {
  status: LiveStatus;
  qrcode: string | null;
  paircode: string | null;
  connected: boolean;
  profileName: string | null;
}

export function InstanceCard({ instance, hostConfigured }: InstanceCardProps) {
  const router = useRouter();

  const [createState, createAction] = useActionState(createInstanceAction, INITIAL_INSTANCE_STATE);
  useActionToast(createState);

  const [instanceId, setInstanceId] = useState<string | null>(instance?.id ?? null);
  const [status, setStatus] = useState<LiveStatus>((instance?.status as LiveStatus) ?? "disconnected");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [polling, setPolling] = useState(instance?.status === "connecting");
  const [expired, setExpired] = useState(false);
  const [isPending, startTransition] = useTransition();

  const attemptsRef = useRef(0);

  // Instância acabou de ser criada: começa a acompanhar o QR code.
  useEffect(() => {
    if (createState.instanceId && createState.instanceId !== instanceId) {
      setInstanceId(createState.instanceId);
      setStatus("connecting");
      setExpired(false);
      attemptsRef.current = 0;
      setPolling(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createState.ts]);

  useEffect(() => {
    if (!polling || !instanceId) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      attemptsRef.current += 1;
      try {
        const res = await fetch(`/api/whatsapp/status?instanceId=${encodeURIComponent(instanceId)}`, {
          cache: "no-store",
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as StatusPayload;
          setStatus(data.status);
          setQrcode(data.qrcode);
          setProfileName(data.profileName);
          if (data.connected) {
            setPolling(false);
            toast.success("WhatsApp conectado.");
            router.refresh();
            return;
          }
        }
      } catch {
        // tenta de novo no próximo tick
      }
      if (attemptsRef.current >= MAX_ATTEMPTS && !cancelled) {
        setPolling(false);
        setExpired(true);
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [polling, instanceId, router]);

  function handleReconnect() {
    if (!instanceId) return;
    startTransition(async () => {
      const res = await reconnectAction(instanceId);
      if (res.ok) {
        setStatus("connecting");
        setExpired(false);
        setQrcode(null);
        attemptsRef.current = 0;
        setPolling(true);
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleDisconnect() {
    if (!instanceId) return;
    startTransition(async () => {
      const res = await disconnectAction(instanceId);
      if (res.ok) {
        setStatus("disconnected");
        setQrcode(null);
        setPolling(false);
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const badgeVariant = status === "connected" ? "default" : status === "connecting" ? "outline" : "secondary";

  return (
    <Section
      title="Conexão"
      description="O número que envia as ofertas precisa ficar conectado nos grupos de promoção."
    >
      <div className="flex flex-col gap-4">
        {!hostConfigured && (
          <AlertBox icon={IconAlerta} variant="warning" title="Host da Uazapi não configurado">
            <p>Preencha o host da Uazapi ao lado antes de criar uma instância.</p>
          </AlertBox>
        )}

        {!instanceId ? (
          <form action={createAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome da instância</Label>
              <Input id="name" name="name" placeholder="Ex.: painel-ofertas" maxLength={60} required />
            </div>
            <SaveButton label="Criar instância" pendingLabel="Criando...">
              <HugeiconsIcon icon={IconWhatsapp} size={14} strokeWidth={1.8} aria-hidden="true" />
              Criar instância
            </SaveButton>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={badgeVariant}>{STATUS_LABEL[status]}</Badge>
              {profileName && <span className="text-sm font-medium">{profileName}</span>}
            </div>

            {status === "connected" && (
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={IconSucesso} size={16} strokeWidth={1.8} className="text-success" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">
                  Conectado e pronto pra mandar oferta pros grupos habilitados abaixo.
                </p>
              </div>
            )}

            {polling && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4">
                {qrcode ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrcode} alt="QR code de conexão do WhatsApp" className="size-56 rounded-md border border-border" />
                ) : (
                  <div className="flex size-56 items-center justify-center rounded-md border border-dashed border-border">
                    <HugeiconsIcon icon={IconCarregando} size={24} strokeWidth={1.8} className="animate-spin text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                <p className="text-center text-xs text-muted-foreground">
                  No WhatsApp do celular: Aparelhos conectados → Conectar um aparelho, e escaneie o código acima.
                </p>
              </div>
            )}

            {expired && (
              <AlertBox icon={IconAlerta} variant="warning" title="O QR code expirou">
                <p>Gere um novo código pra continuar a conexão.</p>
              </AlertBox>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {status !== "connected" && (
                <Button size="sm" onClick={handleReconnect} disabled={isPending || polling}>
                  <HugeiconsIcon icon={IconLigar} size={14} strokeWidth={1.8} aria-hidden="true" />
                  {expired || status === "disconnected" ? "Gerar novo QR code" : "Conectar"}
                </Button>
              )}
              {status === "connected" && (
                <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={isPending}>
                  <HugeiconsIcon icon={IconDesvincular} size={14} strokeWidth={1.6} aria-hidden="true" />
                  Desconectar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
