"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconSucesso, IconCarregando, IconErroCirculo, IconInfo } from "@/components/icons";
import { PageHeader } from "@/components/shell/page-header";
import { Section } from "@/components/shell/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/form/money-input";
import { UrlInput } from "@/components/form/url-input";
import { SlugInput } from "@/components/form/slug-input";
import { IntegerInput } from "@/components/form/integer-input";
import { centsToMasked, moneyToCents } from "@/lib/mask";
import { cn } from "@/lib/utils";
import { LinkPicker } from "./link-picker";
import { PresellPreview } from "./presell-preview";
import { PresellVariableChips, UnknownVariableWarning } from "./presell-variable-chips";
import type { PresellProduct, PresellVariableName } from "./presell-template";
import { upsertPresellAction, checkSlugAvailableAction, slugifyAction } from "./actions";
import { initialActionState } from "./action-state";
import type { EligibleLink, PresellForEdit } from "@/lib/data/presells";

interface PresellEditorProps {
  mode: "create" | "edit";
  presell?: PresellForEdit;
  eligibleLinks: EligibleLink[];
  /// Produtos reais do banco para ver o modelo funcionando.
  previewProducts: PresellProduct[];
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

/// Escreve o marcador na posição do cursor de um campo de texto e devolve o
/// foco para lá — mesmo comportamento do editor de mensagens.
function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  token: string,
  apply: (next: string) => void,
) {
  if (!el) {
    apply(`${current}${token}`);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  apply(`${current.slice(0, start)}${token}${current.slice(end)}`);
  requestAnimationFrame(() => {
    el.focus();
    const cursor = start + token.length;
    el.setSelectionRange(cursor, cursor);
  });
}

export function PresellEditor({ mode, presell, eligibleLinks, previewProducts }: PresellEditorProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(upsertPresellAction, initialActionState);

  const [title, setTitle] = useState(presell?.title ?? "");
  const [slug, setSlug] = useState(presell?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  // computado sincronamente (sem efeito) — o valor inicial já reflete se há
  // endereço pré-preenchido (edição) esperando a checagem assíncrona.
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
  const [isDefault, setIsDefault] = useState(presell?.isDefault ?? false);
  const [hasExitLink, setHasExitLink] = useState(Boolean(presell?.exitLinkId));

  const [previewProductId, setPreviewProductId] = useState<string | null>(
    previewProducts[0]?.id ?? null,
  );

  // Abaixo de lg, o formulário e o preview não cabem lado a lado — vira uma
  // aba por vez para não obrigar a rolar a tela inteira pra ver o preview.
  const [mobileTab, setMobileTab] = useState<"editar" | "preview">("editar");

  const headlineRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sugere o endereço a partir do nome enquanto o usuário não editar o campo
  // manualmente.
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
      toast.success("Modelo salvo.");
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

  const insertInHeadline = (name: PresellVariableName) =>
    insertAtCursor(headlineRef.current, headline, `{{${name}}}`, setHeadline);
  const insertInBody = (name: PresellVariableName) =>
    insertAtCursor(bodyRef.current, body, `{{${name}}}`, setBody);
  const insertInImage = (name: PresellVariableName) =>
    insertAtCursor(imageRef.current, imageUrl, `{{${name}}}`, setImageUrl);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mode === "create" ? "Novo modelo de página" : "Editar modelo de página"}
        description="Um modelo só atende quantos produtos você quiser. O que você deixar em branco é preenchido com os dados do produto na hora que alguém abre o link."
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

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
        <HugeiconsIcon
          icon={IconInfo}
          size={18}
          strokeWidth={1.6}
          className="mt-0.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-muted-foreground">
          Você não precisa criar um modelo por produto. Monte este uma vez e, na tela de ofertas,
          gere quantos links quiser apontando para ele. Cada link mostra a foto, o nome e o preço do
          seu próprio produto.
          {presell && presell.linkCount > 0 && (
            <>
              {" "}
              <strong className="text-foreground">
                {presell.linkCount === 1
                  ? "1 link já usa este modelo."
                  : `${presell.linkCount} links já usam este modelo.`}
              </strong>
            </>
          )}
        </p>
      </div>

      {/* Alternador editar/preview, só abaixo de lg — nas telas largas os dois
          ficam lado a lado e o alternador não faz sentido. */}
      <div className="flex gap-1.5 rounded-lg bg-muted p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("editar")}
          className={cn(
            "min-h-11 flex-1 rounded-md text-sm font-medium transition-colors",
            mobileTab === "editar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={cn(
            "min-h-11 flex-1 rounded-md text-sm font-medium transition-colors",
            mobileTab === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Ver preview
        </button>
      </div>

      <form id="presell-form" action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {presell?.id && <input type="hidden" name="id" value={presell.id} />}
        <input type="hidden" name="isDefault" value={isDefault ? "1" : "0"} />

        <div className={cn("flex flex-col gap-5", mobileTab === "preview" && "hidden lg:flex")}>
          <Section
            title="Identificação"
            description="Só você vê o nome. O endereço é a parte final do link que você vai colar no WhatsApp."
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Nome do modelo</Label>
                <Input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Aquecimento padrão"
                  required
                  maxLength={200}
                />
                {fieldError("title") && <p className="text-xs text-destructive">{fieldError("title")}</p>}
              </div>

              <SlugInput
                label="Endereço do link"
                name="slug"
                value={slug}
                onValueChange={(v) => {
                  setSlugTouched(true);
                  setSlug(v);
                  setSlugStatus(statusForSlug(v));
                }}
                maxLength={80}
                hint="Letras minúsculas, números e hífen entre as palavras. Serve para abrir o modelo sozinho, sem produto."
                error={fieldError("slug")}
                addon={<SlugStatusBadge status={slugStatus} />}
              />

              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="isDefault">Usar este modelo por padrão</Label>
                  <span className="text-xs text-muted-foreground">
                    Quando você gerar um link com página de aquecimento e não escolher o modelo,
                    este é o que vale. Só um modelo pode ficar marcado.
                  </span>
                </div>
                <Switch id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
              </div>
            </div>
          </Section>

          <Section
            title="Conteúdo da página"
            description="Deixe em branco para usar o dado do produto. Use os botões para misturar texto seu com os dados do produto."
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="headline">Chamada principal</Label>
                <PresellVariableChips onInsert={insertInHeadline} />
                <Input
                  id="headline"
                  name="headline"
                  ref={headlineRef}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Em branco = o nome do produto"
                  maxLength={300}
                />
                <UnknownVariableWarning text={headline} />
                {fieldError("headline") && (
                  <p className="text-xs text-destructive">{fieldError("headline")}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="body">Texto de apoio</Label>
                <PresellVariableChips onInsert={insertInBody} />
                <Textarea
                  id="body"
                  name="body"
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={"Ex.: Só hoje por {{preco}}. Antes era {{precoAntigo}}."}
                  rows={4}
                  maxLength={4000}
                />
                <UnknownVariableWarning text={body} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="imageUrl">Foto</Label>
                <PresellVariableChips onInsert={insertInImage} only={["imagem"]} />
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  ref={imageRef}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Em branco = a foto do produto"
                  maxLength={2000}
                />
                {fieldError("imageUrl") && (
                  <p className="text-xs text-destructive">{fieldError("imageUrl")}</p>
                )}
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
            </div>
          </Section>

          <Section
            title="Preço na página"
            description="Deixe os dois em branco para mostrar sempre o preço do produto do link. Preencha só se quiser um valor fixo para todos."
          >
            <div className="grid grid-cols-2 gap-4">
              <MoneyInput
                label="Preço fixo"
                name="priceLabelReais"
                value={priceLabelReais}
                onValueChange={setPriceLabelReais}
              />
              <MoneyInput
                label='Preço fixo "de"'
                name="originalLabelReais"
                value={originalLabelReais}
                onValueChange={setOriginalLabelReais}
              />
            </div>
          </Section>

          <Section
            title="Passo do parceiro"
            description="Página intermediária que a pessoa abre antes de liberar a oferta. Deixe o endereço vazio para pular esse passo."
          >
            <div className="flex flex-col gap-4">
              <UrlInput
                label="Endereço do parceiro"
                name="gateUrl"
                placeholder="https://..."
                value={gateUrl}
                onValueChange={setGateUrl}
                error={fieldError("gateUrl")}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gateLabel">Texto do botão do parceiro</Label>
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
            title="Quando abrirem o modelo sem produto"
            description="Opcional. Vale só para quem abrir o endereço acima direto no navegador. Os links gerados na tela de ofertas já levam ao produto deles e não usam nada daqui."
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

        <div className={cn("lg:sticky lg:top-20 lg:self-start", mobileTab === "editar" && "hidden lg:block")}>
          <PresellPreview
            template={{
              title: title || "Novo modelo",
              headline,
              body,
              ctaText,
              imageUrl,
              priceLabel: priceLabelReais ? moneyToCents(priceLabelReais) : null,
              originalLabel: originalLabelReais ? moneyToCents(originalLabelReais) : null,
              gateUrl,
              gateLabel,
              gateDelay,
            }}
            products={previewProducts}
            productId={previewProductId}
            onProductChange={setPreviewProductId}
            hasExitLink={hasExitLink}
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
