"use client";

import { OfferCard, type OfferCardProps } from "@/components/produto/offer-card";
import { useSelection } from "./selection";

/// Liga o OfferCard (agnóstico de contexto) à seleção múltipla da página.
export function SelectableOfferCard(props: Omit<OfferCardProps, "selected" | "onToggleSelect">) {
  const { selected, toggle } = useSelection();
  return <OfferCard {...props} selected={selected.has(props.offer.id)} onToggleSelect={toggle} />;
}
