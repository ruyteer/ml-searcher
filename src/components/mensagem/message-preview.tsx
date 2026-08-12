import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MessagePreviewProps {
  /// Corpo já renderizado (passado por renderTemplate) — este componente só
  /// desenha a moldura, não sabe nada sobre templates ou variáveis.
  body: string;
  className?: string;
}

/// Moldura estilo balão de WhatsApp: largura de celular, fundo escuro do
/// chat, bolha de mensagem "enviada" alinhada à direita. É assim que a
/// mensagem chega no grupo — usado no preview ao vivo do editor de template
/// e reusável pela fase de WhatsApp para conferir antes de enviar.
export function MessagePreview({ body, className }: MessagePreviewProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[320px] flex-col gap-2 rounded-2xl bg-[#0b141a] p-3",
        className,
      )}
    >
      <div className="ml-auto max-w-[90%] rounded-lg rounded-tr-sm bg-[#005c4b] px-2.5 py-2 text-[13px] leading-snug whitespace-pre-wrap break-words text-[#e9edef] shadow-sm">
        {body ? body : <span className="text-[#e9edef]/50 italic">Mensagem vazia</span>}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#e9edef]/60">
          <span>agora</span>
          <CheckCheck className="size-3.5 text-[#53bdeb]" />
        </div>
      </div>
    </div>
  );
}
