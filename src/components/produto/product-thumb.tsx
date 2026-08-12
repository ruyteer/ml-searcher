import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductThumbProps {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}

/// Thumbnail padrão de produto — usa next/image (hosts do ML já liberados em
/// next.config.ts) com fallback de ícone quando não há imagem.
export function ProductThumb({ src, alt, size = 56, className }: ProductThumbProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-contain p-1"
        />
      ) : (
        <ImageOff className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}
