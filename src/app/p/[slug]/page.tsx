import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { resolvePresellPage } from "@/lib/data/presells";
import { resolvePresell, presellSteps } from "@/app/(painel)/presells/presell-template";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GateFlow } from "./gate-flow";

interface PresellPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PresellPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await resolvePresellPage(slug);
  if (!page) return { title: "Oferta não encontrada" };

  const content = resolvePresell(page.template, page.product);

  return {
    title: content.pageTitle,
    description: content.headline,
    openGraph: {
      title: content.pageTitle,
      description: content.headline,
      images: content.imageUrl ? [{ url: content.imageUrl }] : undefined,
    },
  };
}

export default async function PresellPage({ params }: PresellPageProps) {
  const { slug } = await params;
  const page = await resolvePresellPage(slug);
  if (!page) notFound();

  // conta a visualização sem travar a renderização da página
  after(() =>
    prisma.presell
      .update({
        where: { id: page.presellId },
        data: { views: { increment: 1 } },
        select: { id: true },
      })
      .catch((err) => console.error("falha ao registrar view da presell", err)),
  );

  // O modelo é resolvido com o produto do link: campo vazio herda do produto,
  // campo com variáveis é preenchido com os dados dele.
  const content = resolvePresell(page.template, page.product);
  const steps = presellSteps(content);
  const ctaHref = page.ctaHref;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      {content.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem de host arbitrário, sem next/image
        <img
          src={content.imageUrl}
          alt={content.pageTitle}
          className="aspect-square w-full rounded-xl bg-muted object-cover"
          decoding="async"
        />
      )}

      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl leading-tight font-bold text-balance">{content.headline}</h1>
      </div>

      {content.priceCents != null && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {content.originalCents != null && (
              <span className="text-sm text-muted-foreground line-through">
                {formatBRL(content.originalCents)}
              </span>
            )}
            {content.discount > 0 && <Badge variant="destructive">-{content.discount}%</Badge>}
          </div>
          <span className="text-3xl font-extrabold text-foreground">
            {formatBRL(content.priceCents)}
          </span>
        </div>
      )}

      {content.body && (
        <p className="text-base leading-relaxed whitespace-pre-line text-foreground/90">
          {content.body}
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
        (content.gateUrl ? (
          <GateFlow
            gateUrl={content.gateUrl}
            gateLabel={content.gateLabel}
            gateDelay={content.gateDelay}
            ctaText={content.ctaText}
            ctaHref={ctaHref}
          />
        ) : (
          <a
            href={ctaHref}
            className={cn(buttonVariants(), "h-12 w-full text-base font-semibold")}
          >
            {content.ctaText}
          </a>
        ))}
    </main>
  );
}
