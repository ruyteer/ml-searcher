"use client";

import { useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon, Loading03Icon, ChevronDownIcon, ExternalLinkIcon, Route01Icon, File02Icon } from "@hugeicons/core-free-icons";
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
import { LinkKind } from "@/generated/prisma";
import { generateLink, type GeneratedLink } from "@/app/(painel)/ofertas/actions";
import { cn } from "@/lib/utils";

export interface PresellOption {
  id: string;
  title: string;
}

export interface GenerateLinkMenuProps {
  productId: string;
  presells?: PresellOption[];
  /// Chamado depois que o link é criado (ex.: pra copiar automaticamente).
  onGenerated?: (link: GeneratedLink) => void;
  size?: "default" | "sm" | "xs";
  className?: string;
}

/// Dropdown "Gerar link": direto / rastreado / com pre-sell. Cada opção
/// dispara a Server Action generateLink e copia a URL resultante — o painel
/// não tem uma tela própria para "visualizar antes de copiar".
export function GenerateLinkMenu({ productId, presells = [], onGenerated, size = "sm", className }: GenerateLinkMenuProps) {
  const [isPending, startTransition] = useTransition();

  const run = (kind: LinkKind, presellId?: string) => {
    startTransition(async () => {
      try {
        const link = await generateLink({ productId, kind, presellId: presellId ?? null });
        await navigator.clipboard.writeText(link.url);
        toast.success("Link gerado e copiado", { description: link.url });
        onGenerated?.(link);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível gerar o link");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size={size} className={cn(className)} disabled={isPending}>
            {isPending ? (
              <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={1.5} />
            )}
            Gerar link
            <HugeiconsIcon icon={ChevronDownIcon} size={14} strokeWidth={1.5} className="ml-auto opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tipo de link</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run(LinkKind.DIRECT)}>
          <HugeiconsIcon icon={ExternalLinkIcon} size={15} strokeWidth={1.5} /> Link direto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(LinkKind.TRACKED)}>
          <HugeiconsIcon icon={Route01Icon} size={15} strokeWidth={1.5} /> Link rastreado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={presells.length === 0}>
            <HugeiconsIcon icon={File02Icon} size={15} strokeWidth={1.5} /> Link com pre-sell
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {presells.length === 0 ? (
              <DropdownMenuItem disabled>Nenhuma pre-sell ativa</DropdownMenuItem>
            ) : (
              presells.map((presell) => (
                <DropdownMenuItem key={presell.id} onClick={() => run(LinkKind.PRESELL, presell.id)}>
                  {presell.title}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
