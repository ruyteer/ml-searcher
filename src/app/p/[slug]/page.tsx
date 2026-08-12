import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatBRL, discountPct } from "@/lib/format";
import { LinkKind } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GateFlow } from "./gate-flow";

interface PresellPageProps {
  params: Promise<{ slug: string }>;
}

/// Busca a presell ativa e, junto, o link ativo (que não seja de entrada
/// PRESELL) mais recente pra usar como CTA final — evita pegar o link que
/// levaria de volta pra essa mesma página.
async function getPresell(slug: string) {
  return prisma.presell.findFirst({
    where: { slug, active: true },
    include: {
      links: {
        where: { active: true, kind: { not: LinkKind.PRESELL } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function generateMetadata({ params }: PresellPageProps): Promise<Metadata> {
  const { slug } = await params;
  const presell = await prisma.presell.findFirst({ where: { slug, active: true } });
  if (!presell) return { title: "Oferta não encontrada" };

  return {
    title: presell.title,
    description: presell.headline,
    openGraph: {
      title: presell.title,
      description: presell.headline,
      images: presell.imageUrl ? [{ url: presell.imageUrl }] : undefined,
    },
  };
}

export default async function PresellPage({ params }: PresellPageProps) {
  const { slug } = await params;
  const presell = await getPresell(slug);
  if (!presell) notFound();

  // conta a visualização sem travar a renderização da página
  after(() =>
    prisma.presell
      .update({ where: { id: presell.id }, data: { views: { increment: 1 } } })
      .catch((err) => console.error("falha ao registrar view da presell", err)),
  );

  const link = presell.links[0];
  const ctaHref = link ? `/r/${link.slug}` : null;

  const hasPrice = presell.priceLabel != null;
  const hasDiscount =
    presell.priceLabel != null &&
    presell.originalLabel != null &&
    presell.originalLabel > presell.priceLabel;
  const discount = hasDiscount
    ? discountPct(presell.priceLabel as number, presell.originalLabel as number)
    : 0;

  const hasGate = Boolean(presell.gateUrl);
  const steps = hasGate
    ? [
        `Toque em "${presell.gateLabel}" para acessar o parceiro.`,
        "Aguarde alguns segundos — é rapidinho.",
        `Toque em "${presell.ctaText}" para ver a oferta no Mercado Livre.`,
      ]
    : [
        `Toque em "${presell.ctaText}" abaixo.`,
        "Você será levado direto para a oferta no Mercado Livre.",
      ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      {presell.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem de host arbitrário, sem next/image
        <img
          src={presell.imageUrl}
          alt={presell.title}
          className="aspect-square w-full rounded-xl bg-muted object-cover"
          decoding="async"
        />
      )}

      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl leading-tight font-bold text-balance">{presell.headline}</h1>
      </div>

      {hasPrice && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {presell.originalLabel != null && (
              <span className="text-sm text-muted-foreground line-through">
                {formatBRL(presell.originalLabel)}
              </span>
            )}
            {hasDiscount && <Badge variant="destructive">-{discount}%</Badge>}
          </div>
          <span className="text-3xl font-extrabold text-foreground">
            {formatBRL(presell.priceLabel as number)}
          </span>
        </div>
      )}

      {presell.body && (
        <p className="text-base leading-relaxed whitespace-pre-line text-foreground/90">
          {presell.body}
        </p>
      )}

      <ol className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 text-sm">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      {ctaHref &&
        (presell.gateUrl ? (
          <GateFlow
            gateUrl={presell.gateUrl}
            gateLabel={presell.gateLabel}
            gateDelay={presell.gateDelay}
            ctaText={presell.ctaText}
            ctaHref={ctaHref}
          />
        ) : (
          <a
            href={ctaHref}
            className={cn(buttonVariants(), "h-12 w-full text-base font-semibold")}
          >
            {presell.ctaText}
          </a>
        ))}
    </main>
  );
}
