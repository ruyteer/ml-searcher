"use client";

import { useQueryState } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_OPTIONS } from "@/lib/periods";
import { periodParser } from "./search-params";

/// Seletor de período (7/30/90 dias) com estado na URL — trocar o valor
/// dispara uma navegação (shallow: false) que reexecuta os Server Components
/// da página com o novo período.
export function PeriodSelector() {
  const [period, setPeriod] = useQueryState("period", periodParser);

  return (
    <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
      <SelectTrigger size="sm" className="min-h-11 w-full sm:min-h-0 sm:w-40" aria-label="Período">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
