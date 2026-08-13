"use client";

import { useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { IconMaisOpcoes, IconCarregando, IconVer, IconCopiar, IconSucesso } from "@/components/icons";
import { ShieldBanIcon } from "@hugeicons/core-free-icons";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductThumb } from "@/components/produto/product-thumb";
import { LinkKind } from "@/lib/enums";
import { generateLink } from "@/app/(painel)/ofertas/actions";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductDetailSheet, useProductActions } from "./product-detail-sheet";
import type { ProductListItem } from "@/lib/data/products";
import type { PresellOption } from "@/components/produto/generate-link-menu";

/// Como a variação de preço é dita em português. O número sozinho ("-12%")
/// não diz em relação a quê.
function variationCopy(variationPct: number | null): { text: string; tone: string } {
  if (variationPct === null) return { text: "sem média para comparar ainda", tone: "text-muted-foreground" };
  if (variationPct < 0) return { text: `${Math.abs(variationPct)}% abaixo da média`, tone: "text-success" };
  if (variationPct > 0) return { text: `${variationPct}% acima da média`, tone: "text-danger" };
  return { text: "no mesmo preço da média", tone: "text-muted-foreground" };
}

/// Cartão de produto usado no lugar da tabela abaixo do breakpoint md. Tabela
/// de nove colunas não cabe num celular: aqui fica só o que decide (foto,
/// nome, preço de agora e como ele se compara com a média), e todo o resto vai
/// para o detalhe ou para o menu de ações.
///
/// ATENÇÃO: nada de DropdownMenuLabel neste menu. Ele é o Menu.GroupLabel do
/// Base UI e lança fora de um DropdownMenuGroup, derrubando a página.
export function ProductCard({ product, presells }: { product: ProductListItem; presells: PresellOption[] }) {
  const { open, setOpen, blocked, toggleBlocked, isPending } = useProductActions(product);
  const [isLinkPending, startLinkTransition] = useTransition();
  const variation = variationCopy(product.variationPct);

  const copyTrackedLink = () => {
    startLinkTransition(async () => {
      try {
        const link = await generateLink({ productId: product.id, kind: LinkKind.TRACKED });
        await navigator.clipboard.writeText(link.url);
        toast.success("Link gerado e copiado", { description: link.url });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível gerar o link");
      }
    });
  };

  return (
    <>
      <Card className={cn("flex flex-row items-stretch gap-0 overflow-hidden p-0", blocked && "opacity-70")}>
        {/* Área tocável que abre o detalhe. É um <button> de verdade, então
            funciona no toque e no teclado, sem depender de hover. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-stretch gap-2.5 text-left"
          aria-label={`Ver detalhe de ${product.title}`}
        >
          <div className="relative w-24 shrink-0 self-stretch bg-neutral-100">
            <ProductThumb src={product.thumbnail} alt={product.title} sizes="96px" imageClassName="p-2" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1 py-2.5">
            <span className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground">
              {product.title}
            </span>

            <span className="text-lg leading-none font-semibold tabular-nums text-foreground">
              {formatBRL(product.price)}
            </span>

            <span className={cn("text-xs", variation.tone)}>{variation.text}</span>

            <span className="truncate text-[11px] text-muted-foreground">
              {product.watchLabel ?? product.categoryName ?? "sem categoria monitorada"} - visto{" "}
              {formatDateTime(product.lastSeenAt)}
            </span>

            {blocked && (
              <Badge variant="destructive" className="w-fit">
                Bloqueado
              </Badge>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-start p-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-11"
                  aria-label="Mais ações"
                  disabled={isPending || isLinkPending}
                >
                  {isPending || isLinkPending ? (
                    <HugeiconsIcon icon={IconCarregando} size={18} strokeWidth={1.5} className="animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={IconMaisOpcoes} size={18} strokeWidth={1.5} />
                  )}
                </Button>
              }
            />
            {/* py-2.5: item de menu com altura de toque confortável. Este menu
                só existe no celular. */}
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem className="py-2.5" onClick={() => setOpen(true)}>
                <HugeiconsIcon icon={IconVer} size={16} strokeWidth={1.5} /> Ver detalhe e histórico
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2.5" onClick={copyTrackedLink}>
                <HugeiconsIcon icon={IconCopiar} size={16} strokeWidth={1.5} /> Copiar link rastreado
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="py-2.5"
                variant={blocked ? "default" : "destructive"}
                disabled={isPending}
                onClick={toggleBlocked}
              >
                <HugeiconsIcon icon={blocked ? IconSucesso : ShieldBanIcon} size={16} strokeWidth={1.5} />
                {blocked ? "Desbloquear produto" : "Bloquear produto"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <ProductDetailSheet
        product={product}
        presells={presells}
        open={open}
        onOpenChange={setOpen}
        blocked={blocked}
        onToggleBlocked={toggleBlocked}
        isPending={isPending}
      />
    </>
  );
}
