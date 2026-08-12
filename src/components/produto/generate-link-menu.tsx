"use client";

import { useTransition } from "react";
import { Link2, Loader2, ChevronDown, ExternalLink, Route, FileText } from "lucide-react";
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
            {isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
            Gerar link
            <ChevronDown className="ml-auto opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tipo de link</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run(LinkKind.DIRECT)}>
          <ExternalLink /> Link direto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(LinkKind.TRACKED)}>
          <Route /> Link rastreado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={presells.length === 0}>
            <FileText /> Link com pre-sell
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
