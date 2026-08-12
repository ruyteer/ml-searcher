"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconSucesso, IconCarregando, IconErroCirculo } from "@/components/icons";
import { PageHeader } from "@/components/shell/page-header";
import { Section } from "@/components/shell/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/form/money-input";
import { UrlInput } from "@/components/form/url-input";
import { SlugInput } from "@/components/form/slug-input";
import { IntegerInput } from "@/components/form/integer-input";
import { centsToMasked, moneyToCents } from "@/lib/mask";
import { LinkPicker } from "./link-picker";
import { PresellPreview } from "./presell-preview";
import { upsertPresellAction, checkSlugAvailableAction, slugifyAction } from "./actions";
import { initialActionState } from "./action-state";
import type { EligibleLink, PresellForEdit } from "@/lib/data/presells";

interface PresellEditorProps {
  mode: "create" | "edit";
  presell?: PresellForEdit;
  eligibleLinks: EligibleLink[];
}

function centsToInputValue(cents: number | null): string {
  if (cents == null) return "";
  return centsToMasked(cents);
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

              <SlugInput
                label="Slug"
                name="slug"
                value={slug}
                onValueChange={(v) => {
                  setSlugTouched(true);
                  setSlug(v);
                  setSlugStatus(statusForSlug(v));
                }}
                required
                maxLength={80}
                hint="Letras minúsculas, números e hífen entre as palavras."
                error={fieldError("slug")}
                addon={<SlugStatusBadge status={slugStatus} />}
              />

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

              <UrlInput
                label="URL da imagem"
                name="imageUrl"
                value={imageUrl}
                onValueChange={setImageUrl}
                placeholder="https://..."
                error={fieldError("imageUrl")}
              />
            </div>
          </Section>

          <Section title="Preço na vitrine" description="Opcional. Valores em reais, salvos em centavos.">
            <div className="grid grid-cols-2 gap-4">
              <MoneyInput
                label="Preço"
                name="priceLabelReais"
                value={priceLabelReais}
                onValueChange={setPriceLabelReais}
              />
              <MoneyInput
                label='Preço "de"'
                name="originalLabelReais"
                value={originalLabelReais}
                onValueChange={setOriginalLabelReais}
              />
            </div>
          </Section>

          <Section
            title="Gate"
            description="Passo intermediário antes do botão final. Deixe a URL vazia pra pular esse passo."
          >
            <div className="flex flex-col gap-4">
              <UrlInput
                label="URL do parceiro"
                name="gateUrl"
                placeholder="https://..."
                value={gateUrl}
                onValueChange={setGateUrl}
                error={fieldError("gateUrl")}
              />
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
              <IntegerInput
                label="Espera antes de liberar o botão final (segundos)"
                name="gateDelay"
                min={0}
                max={30}
                value={String(gateDelay)}
                onValueChange={(v) => setGateDelay(v === "" ? 0 : Number(v))}
                hint="0 libera o botão direto, sem contagem regressiva."
              />
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
              priceLabelCents: priceLabelReais ? moneyToCents(priceLabelReais) : null,
              originalLabelCents: originalLabelReais ? moneyToCents(originalLabelReais) : null,
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

function SlugStatusBadge({ status }: { status: SlugStatus }) {
  switch (status) {
    case "checking":
      return (
        <HugeiconsIcon
          icon={IconCarregando}
          size={16}
          strokeWidth={1.8}
          className="shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      );
    case "available":
      return <HugeiconsIcon icon={IconSucesso} size={16} strokeWidth={1.8} className="shrink-0 text-success" aria-hidden="true" />;
    case "taken":
      return <HugeiconsIcon icon={IconErroCirculo} size={16} strokeWidth={1.8} className="shrink-0 text-destructive" aria-hidden="true" />;
    case "reserved":
      return <HugeiconsIcon icon={IconErroCirculo} size={16} strokeWidth={1.8} className="shrink-0 text-destructive" aria-hidden="true" />;
    case "invalid":
      return <HugeiconsIcon icon={IconErroCirculo} size={16} strokeWidth={1.8} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
    default:
      return null;
  }
}
