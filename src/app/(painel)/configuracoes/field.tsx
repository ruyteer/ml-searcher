"use client";

import type { ComponentProps, ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconInfo } from "@/components/icons";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  /// Nome do campo, só para montar o aria-label do gatilho ("Ajuda sobre X").
  label: string;
  children: ReactNode;
}

/// Ícone de ajuda que abre um popover com o texto de contexto do campo, ao
/// invés de imprimir esse texto direto na tela. Usa Popover (não Tooltip)
/// de propósito: abre no toque/clique, não só no hover, então funciona em
/// celular. O gatilho é um <button> nativo, focável por teclado, com
/// aria-label próprio e type="button" (não envia formulário sem querer).
export function HelpTooltip({ label, children }: HelpTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Ajuda sobre ${label}`}
        className="-m-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <HugeiconsIcon icon={IconInfo} size={14} strokeWidth={1.6} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs text-muted-foreground" sideOffset={6} align="end">
        {children}
      </PopoverContent>
    </Popover>
  );
}

interface FieldWithHelpProps {
  label: string;
  help: ReactNode;
  children: ReactNode;
  className?: string;
}

/// Envolve um campo pronto (PercentInput, IntegerInput, MoneyInput...) com o
/// ícone de ajuda ao lado, quando o campo em si não tem como receber esse
/// ícone junto do próprio label. O ícone fica alinhado ao topo, à altura do
/// label do campo.
export function FieldWithHelp({ label, help, children, className }: FieldWithHelpProps) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <HelpTooltip label={label}>{help}</HelpTooltip>
    </div>
  );
}

interface FieldProps extends Omit<ComponentProps<typeof Input>, "onChange"> {
  label: string;
  name: string;
  /// Ajuda de contexto: vira ícone + popover ao lado do label. Preferir a
  /// `help` em campos novos, mantém a tela limpa.
  tooltip?: ReactNode;
  /// Texto fixo abaixo do campo, sempre visível. Reservado para avisos que
  /// evitam erro caro (ex.: "deixe vazio para..."); ajuda de contexto vai em
  /// `tooltip`. Mantido por compatibilidade com quem já usa este campo.
  help?: string;
  defaultText?: string;
  error?: string;
  /// Uso controlado (state no componente pai). Sem isso o input fica
  /// não-controlado (defaultValue), útil em diálogos que resetam por `key`.
  onValueChange?: (value: string) => void;
}

/// Input com label (+ ícone de ajuda opcional), valor padrão exibido ao
/// lado e erro de validação — a unidade básica de campo usada nos forms
/// simples da página.
export function Field({
  label,
  name,
  tooltip,
  help,
  defaultText,
  error,
  className,
  onValueChange,
  ...rest
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={name}>{label}</Label>
          {tooltip && <HelpTooltip label={label}>{tooltip}</HelpTooltip>}
        </div>
        {defaultText && <span className="text-xs text-muted-foreground">{defaultText}</span>}
      </div>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        className={cn(className)}
        {...rest}
      />
      {help && !error && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
