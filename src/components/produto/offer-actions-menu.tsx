"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreVerticalIcon,
  ExternalLinkIcon,
  Route01Icon,
  File02Icon,
  Tick02Icon,
  Cancel01Icon,
  ShieldBanIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LinkKind, OfferStatus } from "@/generated/prisma";
import { generateLink } from "@/app/(painel)/ofertas/actions";
import type { PresellOption } from "./generate-link-menu";

export interface OfferActionsMenuProps {
  productId: string;
  productTitle: string;
  presells: PresellOption[];
  status: OfferStatus;
  blocked: boolean;
  isPending: boolean;
  onMarkPublished: () => void;
  onMarkIgnored: () => void;
  onBlock: () => void;
  className?: string;
}

/// Menu "kebab" (três pontos) do card de oferta: reúne tudo que não precisa
/// ficar visível de cara (gerar link nos 3 formatos, marcar publicada,
/// ignorar, bloquear). Bloquear é destrutivo, então sempre passa por um
/// AlertDialog de confirmação antes de chamar onBlock.
export function OfferActionsMenu({
  productId,
  productTitle,
  presells,
  status,
  blocked,
  isPending,
  onMarkPublished,
  onMarkIgnored,
  onBlock,
  className,
}: OfferActionsMenuProps) {
  const [isLinkPending, startLinkTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runGenerate = (kind: LinkKind, presellId?: string) => {
    startLinkTransition(async () => {
      try {
        const link = await generateLink({ productId, kind, presellId: presellId ?? null });
        await navigator.clipboard.writeText(link.url);
        toast.success("Link gerado e copiado", { description: link.url });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível gerar o link");
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              className={className}
              disabled={isPending || isLinkPending}
              aria-label="Mais ações"
            >
              {isLinkPending ? (
                <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <HugeiconsIcon icon={MoreVerticalIcon} size={16} strokeWidth={1.5} />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Gerar link</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => runGenerate(LinkKind.DIRECT)}>
            <HugeiconsIcon icon={ExternalLinkIcon} size={15} strokeWidth={1.5} /> Link direto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => runGenerate(LinkKind.TRACKED)}>
            <HugeiconsIcon icon={Route01Icon} size={15} strokeWidth={1.5} /> Link rastreado
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={presells.length === 0}>
              <HugeiconsIcon icon={File02Icon} size={15} strokeWidth={1.5} /> Link com pre-sell
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {presells.length === 0 ? (
                <DropdownMenuItem disabled>Nenhuma pre-sell ativa</DropdownMenuItem>
              ) : (
                presells.map((presell) => (
                  <DropdownMenuItem key={presell.id} onClick={() => runGenerate(LinkKind.PRESELL, presell.id)}>
                    {presell.title}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={isPending || status === OfferStatus.PUBLISHED} onClick={onMarkPublished}>
            <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={1.5} /> Marcar como publicada
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isPending || status === OfferStatus.IGNORED} onClick={onMarkIgnored}>
            <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.5} /> Ignorar oferta
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" disabled={isPending || blocked} onClick={() => setConfirmOpen(true)}>
            <HugeiconsIcon icon={ShieldBanIcon} size={15} strokeWidth={1.5} /> Bloquear produto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {productTitle} deixa de gerar novas ofertas e as ofertas pendentes dele são ignoradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onBlock}>
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
