"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Link2Off, Link2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { searchProductsAction } from "./actions";
import type { EligibleLink } from "@/lib/data/presells";
import type { ProductSearchResult } from "@/lib/data/presells";

type LinkMode = "none" | "existing" | "new";

interface LinkPickerProps {
  eligibleLinks: EligibleLink[];
  initialMode?: LinkMode;
  initialExistingLinkId?: string | null;
  fieldErrors?: { existingLinkId?: string[]; newProductId?: string[] };
  /// Avisa o formulário pai se há (ou vai haver) um link de saída resolvido,
  /// pra alimentar o aviso no preview ao vivo.
  onHasLinkChange?: (hasLink: boolean) => void;
}

const MODE_OPTIONS: { value: LinkMode; label: string; icon: typeof Link2 }[] = [
  { value: "none", label: "Nenhum", icon: Link2Off },
  { value: "existing", label: "Link existente", icon: Link2 },
  { value: "new", label: "Novo, a partir de um produto", icon: Search },
];

/// Escolhe (ou cria) o link que vai virar o botão final da pre-sell.
/// Emite o estado como inputs escondidos dentro do form do editor.
export function LinkPicker({
  eligibleLinks,
  initialMode = "none",
  initialExistingLinkId,
  fieldErrors,
  onHasLinkChange,
}: LinkPickerProps) {
  const [mode, setMode] = useState<LinkMode>(initialMode);
  const [existingLinkId, setExistingLinkId] = useState(initialExistingLinkId ?? "");
  const [product, setProduct] = useState<ProductSearchResult | null>(null);

  useEffect(() => {
    const hasLink =
      (mode === "existing" && Boolean(existingLinkId)) || (mode === "new" && Boolean(product));
    onHasLinkChange?.(hasLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, existingLinkId, product]);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="linkMode" value={mode} />
      {mode === "existing" && <input type="hidden" name="existingLinkId" value={existingLinkId} />}
      {mode === "new" && <input type="hidden" name="newProductId" value={product?.id ?? ""} />}

      <div className="flex flex-wrap gap-1.5">
        {MODE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={mode === opt.value ? "default" : "outline"}
            onClick={() => setMode(opt.value)}
          >
            <opt.icon className="size-3.5" />
            {opt.label}
          </Button>
        ))}
      </div>

      {mode === "existing" && (
        <div className="flex flex-col gap-1.5">
          <Select value={existingLinkId} onValueChange={(v) => setExistingLinkId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um link" />
            </SelectTrigger>
            <SelectContent>
              {eligibleLinks.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Nenhum link livre disponível — crie um novo.
                </div>
              )}
              {eligibleLinks.map((link) => (
                <SelectItem key={link.id} value={link.id}>
                  {link.productTitle ?? link.label ?? link.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors?.existingLinkId && (
            <p className="text-xs text-destructive">{fieldErrors.existingLinkId[0]}</p>
          )}
        </div>
      )}

      {mode === "new" && (
        <div className="flex flex-col gap-1.5">
          <ProductCombobox value={product} onChange={setProduct} />
          {fieldErrors?.newProductId && (
            <p className="text-xs text-destructive">{fieldErrors.newProductId[0]}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProductCombobox({
  value,
  onChange,
}: {
  value: ProductSearchResult | null;
  onChange: (p: ProductSearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // campo vazio já é tratado no onChange do input (evento síncrono) —
    // aqui só sobra a busca debounced quando há texto.
    if (!query.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const found = await searchProductsAction(query);
        setResults(found);
        setOpen(true);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-input p-2">
        {value.thumbnail ? (
          <Image
            src={value.thumbnail}
            alt={value.title}
            width={32}
            height={32}
            className="size-8 rounded-md object-cover"
          />
        ) : (
          <div className="size-8 shrink-0 rounded-md bg-muted" />
        )}
        <div className="flex flex-1 flex-col overflow-hidden">
          <span className="line-clamp-1 text-sm">{value.title}</span>
          <span className="text-xs text-muted-foreground">{formatBRL(value.price)}</span>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)}>
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Label htmlFor="product-search" className="sr-only">
        Buscar produto
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="product-search"
          placeholder="Buscar produto por título..."
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (!v.trim()) {
              setResults([]);
              setOpen(false);
            }
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-8"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-accent",
                )}
              >
                {p.thumbnail ? (
                  <Image
                    src={p.thumbnail}
                    alt={p.title}
                    width={28}
                    height={28}
                    className="size-7 rounded object-cover"
                  />
                ) : (
                  <div className="size-7 shrink-0 rounded bg-muted" />
                )}
                <span className="line-clamp-1 flex-1">{p.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBRL(p.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
