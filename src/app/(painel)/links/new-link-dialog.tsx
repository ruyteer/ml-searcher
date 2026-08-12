"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconAdicionar } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UrlInput } from "@/components/form/url-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LinkKind } from "@/generated/prisma";
import { createStandaloneLinkAction } from "./actions";
import { initialActionState } from "./action-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando..." : "Criar link"}
    </Button>
  );
}

/// Cria um link avulso — não precisa vir de um produto do catálogo, só uma
/// URL de destino qualquer que a gente queira rastrear.
export function NewLinkDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createStandaloneLinkAction, initialActionState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast.success("Link criado.");
      // reage ao resultado assíncrono da Server Action — não há evento
      // síncrono equivalente pra disparar isso fora de um efeito.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button />}>
        <HugeiconsIcon icon={IconAdicionar} size={16} strokeWidth={1.8} aria-hidden="true" /> Novo link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo link avulso</DialogTitle>
          <DialogDescription>
            Cole qualquer URL de destino para gerar um link curto rastreável.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3">
          <UrlInput
            label="URL de destino"
            name="targetUrl"
            placeholder="https://..."
            required
            error={state.fieldErrors?.targetUrl?.[0]}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kind">Tipo</Label>
            <Select name="kind" defaultValue={LinkKind.TRACKED}>
              <SelectTrigger id="kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LinkKind.TRACKED}>Rastreado (conta clique)</SelectItem>
                <SelectItem value={LinkKind.DIRECT}>Direto (sem contagem)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Rótulo (opcional)</Label>
            <Input id="label" name="label" placeholder="Ex.: Campanha grupo VIP" maxLength={80} />
            {state.fieldErrors?.label && (
              <p className="text-xs text-destructive">{state.fieldErrors.label[0]}</p>
            )}
          </div>

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
