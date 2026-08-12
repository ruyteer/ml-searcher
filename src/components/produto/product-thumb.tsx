import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageNotFound02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface ProductThumbProps {
  src: string | null;
  alt: string;
  /// Tamanho fixo em px (thumbnail quadrada, usada na tabela e no Sheet de
  /// detalhe). Omitido = preenche 100% do contêiner pai, que passa a
  /// controlar a proporção (usado na imagem de capa do OfferCard).
  size?: number;
  sizes?: string;
  className?: string;
  imageClassName?: string;
}

/// Superfície de imagem de produto: fundo neutro claro fixo. Fotos do
/// Mercado Livre quase sempre têm fundo branco, e um fundo escuro (tema
/// padrão do app) faria a foto "sumir"; por isso a superfície da imagem fica
/// sempre clara, mesmo no tema escuro. next/image com fallback de ícone
/// quando não há imagem.
export function ProductThumb({ src, alt, size, sizes, className, imageClassName }: ProductThumbProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-neutral-100",
        size ? "rounded-lg border border-border" : "h-full w-full",
        className,
      )}
      style={size ? { width: size, height: size } : undefined}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? (size ? `${size}px` : "(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw")}
          className={cn("object-contain", size ? "p-1" : "p-4", imageClassName)}
        />
      ) : (
        <HugeiconsIcon
          icon={ImageNotFound02Icon}
          size={size ? Math.max(14, Math.round(size / 3)) : 32}
          strokeWidth={1.5}
          className="text-neutral-400"
        />
      )}
    </div>
  );
}
