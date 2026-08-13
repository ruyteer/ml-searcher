"use client";

import { useActionState, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconVer, IconOcultar } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveUazapiConfigAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";

export interface UazapiConfigFormProps {
  uazapiHost: string;
  adminTokenConfigured: boolean;
}

export function UazapiConfigForm({ uazapiHost, adminTokenConfigured }: UazapiConfigFormProps) {
  const [state, formAction] = useActionState(saveUazapiConfigAction, INITIAL_ACTION_STATE);
  useActionToast(state);

  const [showToken, setShowToken] = useState(false);
  const [adminToken, setAdminToken] = useState("");

  return (
    <Section title="Uazapi" description="Servidor que fala com o WhatsApp. Uma vez configurado, raramente muda.">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="uazapiHost">Host</Label>
          <Input
            id="uazapiHost"
            name="uazapiHost"
            defaultValue={uazapiHost}
            placeholder="https://free.uazapi.com"
            aria-invalid={Boolean(state.errors?.uazapiHost)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="uazapiAdminToken">Token de administrador</Label>
          <div className="relative">
            <Input
              id="uazapiAdminToken"
              name="uazapiAdminToken"
              type={showToken ? "text" : "password"}
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder={adminTokenConfigured ? "•••••••• (mantém o valor salvo)" : "Cole aqui o admintoken"}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showToken ? "Ocultar token" : "Mostrar token"}
            >
              {showToken ? (
                <HugeiconsIcon icon={IconOcultar} size={16} strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <HugeiconsIcon icon={IconVer} size={16} strokeWidth={1.6} aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Usado só pra criar/listar instâncias. O valor salvo nunca é reexibido: deixe em branco pra mantê-lo.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <SaveButton />
        </div>
      </form>
    </Section>
  );
}
