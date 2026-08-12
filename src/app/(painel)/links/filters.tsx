"use client";

import { useQueryStates, debounce } from "nuqs";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconBuscar, IconFechar } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LinkKind } from "@/lib/enums";
import { linksSearchParams } from "./search-params";

const KIND_LABELS: Record<string, string> = {
  all: "Todos os tipos",
  [LinkKind.DIRECT]: "Direto",
  [LinkKind.TRACKED]: "Rastreado",
  [LinkKind.PRESELL]: "Pre-sell",
};

const PERIOD_LABELS: Record<string, string> = {
  all: "Todo o período",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

/// Barra de filtros de /links — todo o estado vive na URL via nuqs, então
/// filtros são compartilháveis por link e sobrevivem a um refresh.
export function LinkFilters() {
  const [state, setState] = useQueryStates(
    {
      kind: linksSearchParams.kind,
      active: linksSearchParams.active,
      q: linksSearchParams.q.withOptions({ limitUrlUpdates: debounce(300) }),
      period: linksSearchParams.period,
    },
    { shallow: false },
  );

  const hasFilters =
    state.kind !== "all" || state.active !== "all" || state.q !== "" || state.period !== "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-56">
        <HugeiconsIcon icon={IconBuscar} size={16} strokeWidth={1.6} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Buscar por slug ou produto..."
          defaultValue={state.q}
          onChange={(e) => setState({ q: e.target.value || null })}
          className="pl-8"
        />
      </div>

      <Select value={state.kind} onValueChange={(v) => setState({ kind: v as typeof state.kind })}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.active}
        onValueChange={(v) => setState({ active: v as typeof state.active })}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Ativos e inativos</SelectItem>
          <SelectItem value="active">Somente ativos</SelectItem>
          <SelectItem value="inactive">Somente inativos</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={state.period}
        onValueChange={(v) => setState({ period: v as typeof state.period })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setState({ kind: null, active: null, q: null, period: null })}
        >
          <HugeiconsIcon icon={IconFechar} size={14} strokeWidth={1.8} aria-hidden="true" />
          Limpar
        </Button>
      )}
    </div>
  );
}
