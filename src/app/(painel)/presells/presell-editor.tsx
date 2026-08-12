"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Section } from "@/components/shell/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fromCents } from "@/lib/format";
import { LinkPicker } from "./link-picker";
import { PresellPreview } from "./presell-preview";
import { upsertPresellAction, checkSlugAvailableAction, slugifyAction, initialActionState } from "./actions";
import type { EligibleLink, PresellForEdit } from "@/lib/data/presells";

interface PresellEditorProps {
  mode: "create" | "edit";
  presell?: PresellForEdit;
  eligibleLinks: EligibleLink[];
}

function centsToInputValue(cents: number | null): string {
  if (cents == null) return "";
  return fromCents(cents).toFixed(2).replace(".", ",");
}

type SlugStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";

const SLUG_FORMAT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/// Status "imediato" só de formato — o resultado da checagem no banco
/// (available/taken/reserved) chega depois, assíncrono.
function statusForSlug(value: string): SlugStatus {
  if (!value) return "idle";
  return SLUG_FORMAT_RE.test(value) ? "checking" : "invalid";
}

export function PresellEditor({ mode, presell, eligibleLinks }: PresellEditorProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(upsertPresellAction, initialActionState);

  const [title, setTitle] = useState(presell?.title ?? "");
  const [slug, setSlug] = useState(presell?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  // computado sincronamente (sem efeito) — o valor inicial já reflete se há
  // slug pré-preenchido (edição) esperando a checagem assíncrona.
  const [slugStatus, setSlugStatus] = useState<SlugStatus>(() => statusForSlug(presell?.slug ?? ""));

  const [headline, setHeadline] = useState(presell?.headline ?? "");
  const [body, setBody] = useState(presell?.body ?? "");
  const [ctaText, setCtaText] = useState(presell?.ctaText ?? "Liberar oferta");
  const [imageUrl, setImageUrl] = useState(presell?.imageUrl ?? "");
  const [priceLabelReais, setPriceLabelReais] = useState(centsToInputValue(presell?.priceLabel ?? null));
  const [originalLabelReais, setOriginalLabelReais] = useState(
    centsToInputValue(presell?.originalLabel ?? null),
  );
  const [gateUrl, setGateUrl] = useState(presell?.gateUrl ?? "");
  const [gateLabel, setGateLabel] = useState(presell?.gateLabel ?? "Acessar link do patrocinador");
  const [gateDelay, setGateDelay] = useState(presell?.gateDelay ?? 5);
  const [hasExitLink, setHasExitLink] = useState(Boolean(presell?.exitLinkId));

  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sugere o slug a partir do título enquanto o usuário não editar o campo
  // slug manualmente.
  useEffect(() => {
    if (slugTouched) return;
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    titleDebounce.current = setTimeout(() => {
      slugifyAction(title).then((s) => {
        setSlug(s);
        setSlugStatus(statusForSlug(s));
      });
    }, 250);
    return () => {
      if (titleDebounce.current) clearTimeout(titleDebounce.current);
    };
  }, [title, slugTouched]);

  // checagem de disponibilidade ao vivo — o status "idle/invalid/checking"
  // já é decidido no onChange do campo (evento síncrono); o efeito só
  // dispara a checagem assíncrona debounced e resolve o status final.
  useEffect(() => {
    if (!slug || !SLUG_FORMAT_RE.test(slug)) return;
    if (slugDebounce.current) clearTimeout(slugDebounce.current);
    slugDebounce.current = setTimeout(() => {
      checkSlugAvailableAction(slug, presell?.id).then((res) => {
        if (res.reserved) setSlugStatus("reserved");
        else setSlugStatus(res.available ? "available" : "taken");
      });
    }, 400);
    return () => {
      if (slugDebounce.current) clearTimeout(slugDebounce.current);
    };
  }, [slug, presell?.id]);

  useEffect(() => {
    if (state.success) {
      toast.success("Pre-sell salva.");
      if (mode === "create" && state.presellId) {
        router.push(`/presells/${state.presellId}`);
      } else {
        router.refresh();
      }
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mode === "create" ? "Nova pre-sell" : "Editar pre-sell"}
        description="O formulário à esquerda atualiza o preview ao vivo à direita conforme você digita."
        actions={
          <>
            <Button variant="outline" render={<Link href="/presells" />}>
              Cancelar
            </Button>
            <Button type="submit" form="presell-form" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      />

      <form id="presell-form" action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {presell?.id && <input type="hidden" name="id" value={presell.id} />}

        <div className="flex flex-col gap-5">
          <Section title="Conteúdo">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Título (uso interno)</Label>
                <Input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                />
                {fieldError("title") && <p className="text-xs text-destructive">{fieldError("title")}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slug">Slug (/p/...)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="slug"
                    name="slug"
                    value={slug}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSlugTouched(true);
                      setSlug(v);
                      setSlugStatus(statusForSlug(v));
                    }}
                    required
                    maxLength={80}
                    className="font-mono"
                  />
                  <SlugStatusBadge status={slugStatus} />
                </div>
                <p className="text-xs text-muted-foreground">letras minúsculas, números e hífens</p>
                {fieldError("slug") && <p className="text-xs text-destructive">{fieldError("slug")}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  name="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  required
                  maxLength={300}
                />
                {fieldError("headline") && (
                  <p className="text-xs text-destructive">{fieldError("headline")}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="body">Texto de apoio</Label>
                <Textarea
                  id="body"
                  name="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={4000}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ctaText">Texto do botão final</Label>
                <Input
                  id="ctaText"
                  name="ctaText"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  required
                  maxLength={60}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="imageUrl">URL da imagem</Label>
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
                {fieldError("imageUrl") && (
                  <p className="text-xs text-destructive">{fieldError("imageUrl")}</p>
                )}
              </div>
            </div>
          </Section>

          <Section title="Preço na vitrine" description="Opcional — valores em reais, salvos em centavos.">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priceLabelReais">Preço</Label>
                <Input
                  id="priceLabelReais"
                  name="priceLabelReais"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={priceLabelReais}
                  onChange={(e) => setPriceLabelReais(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="originalLabelReais">Preço &quot;de&quot;</Label>
                <Input
                  id="originalLabelReais"
                  name="originalLabelReais"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={originalLabelReais}
                  onChange={(e) => setOriginalLabelReais(e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Gate"
            description="Passo intermediário antes do botão final. Deixe a URL vazia pra pular esse passo."
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gateUrl">URL do parceiro</Label>
                <Input
                  id="gateUrl"
                  name="gateUrl"
                  type="url"
                  placeholder="https://..."
                  value={gateUrl}
                  onChange={(e) => setGateUrl(e.target.value)}
                />
                {fieldError("gateUrl") && <p className="text-xs text-destructive">{fieldError("gateUrl")}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gateLabel">Rótulo do botão do gate</Label>
                <Input
                  id="gateLabel"
                  name="gateLabel"
                  value={gateLabel}
                  onChange={(e) => setGateLabel(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gateDelay">Espera antes de liberar o botão final</Label>
                  <span className="text-sm font-medium text-foreground">{gateDelay}s</span>
                </div>
                <input
                  id="gateDelay"
                  name="gateDelay"
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={gateDelay}
                  onChange={(e) => setGateDelay(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-muted-foreground">
                  0 libera o botão direto, sem contagem regressiva.
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Link de saída"
            description="A página pública precisa de um link associado pra exibir o botão final."
          >
            <LinkPicker
              eligibleLinks={eligibleLinks}
              initialMode={presell?.exitLinkId ? "existing" : "none"}
              initialExistingLinkId={presell?.exitLinkId}
              fieldErrors={state.fieldErrors}
              onHasLinkChange={setHasExitLink}
            />
          </Section>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <PresellPreview
            data={{
              title: title || "Nova pre-sell",
              headline,
              body,
              ctaText,
              imageUrl,
              priceLabelCents: priceLabelReais ? Math.round(parseReais(priceLabelReais) * 100) : null,
              originalLabelCents: originalLabelReais
                ? Math.round(parseReais(originalLabelReais) * 100)
                : null,
              gateUrl,
              gateLabel,
              gateDelay,
              hasExitLink,
            }}
          />
        </div>
      </form>
    </div>
  );
}

function parseReais(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function SlugStatusBadge({ status }: { status: SlugStatus }) {
  switch (status) {
    case "checking":
      return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
    case "available":
      return <CheckCircle2 className="size-4 shrink-0 text-success" />;
    case "taken":
      return <XCircle className="size-4 shrink-0 text-destructive" />;
    case "reserved":
      return <XCircle className="size-4 shrink-0 text-destructive" />;
    case "invalid":
      return <XCircle className="size-4 shrink-0 text-muted-foreground" />;
    default:
      return null;
  }
}
