"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconCopiar, IconCliques, IconCarregando, IconSemImagem } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCompact, formatDateTime } from "@/lib/format";
import { listPresellLinksAction } from "./actions";
import type { PresellLinkRow } from "@/lib/data/presells";

interface PresellLinksDialogProps {
  presellId: string;
  presellTitle: string;
  /// Base pública já resolvida (domínio configurado ou o da própria janela).
  publicBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/// Lista os links já gerados em cima de um modelo. É a prova visual de que um
/// modelo só está atendendo vários produtos diferentes.
export function PresellLinksDialog({
  presellId,
  presellTitle,
  publicBase,
  open,
  onOpenChange,
}: PresellLinksDialogProps) {
  const [links, setLinks] = useState<PresellLinkRow[] | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      try {
        setLinks(await listPresellLinksAction(presellId));
      } catch {
        toast.error("Não foi possível carregar os links.");
        setLinks([]);
      }
    });
  }, [open, presellId]);

  function copy(slug: string) {
    navigator.clipboard
      .writeText(`${publicBase}/p/${slug}`)
      .then(() => toast.success("Link copiado."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Links que usam {presellTitle}</DialogTitle>
          <DialogDescription>
            Cada link abre esta mesma página com o produto dele. Os 50 mais recentes.
          </DialogDescription>
        </DialogHeader>

        {links === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <HugeiconsIcon icon={IconCarregando} size={16} strokeWidth={1.8} className="animate-spin" aria-hidden="true" />
            Carregando...
          </div>
        ) : links.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum link ainda. Vá até a tela de ofertas, escolha um produto e gere um link com
            página de aquecimento.
          </p>
        ) : (
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-accent/50"
              >
                {link.productThumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto vem de host arbitrário
                  <img
                    src={link.productThumbnail}
                    alt=""
                    className="size-9 shrink-0 rounded-md bg-muted object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={IconSemImagem} size={14} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-1 text-sm">
                    {link.productTitle ?? "Sem produto"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">/p/{link.slug}</span>
                </div>

                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={IconCliques} size={13} strokeWidth={1.6} aria-hidden="true" />
                  {formatCompact(link.clickCount)}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {formatDateTime(link.createdAt)}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-11 sm:size-7"
                  onClick={() => copy(link.slug)}
                  aria-label="Copiar link"
                >
                  <HugeiconsIcon icon={IconCopiar} size={14} strokeWidth={1.8} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
