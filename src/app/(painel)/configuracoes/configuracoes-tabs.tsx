"use client";

import { useQueryState } from "nuqs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DeteccaoTab } from "./deteccao-tab";
import { CategoriasTab } from "./categorias-tab";
import { LinksTab } from "./links-tab";
import { MercadoLivreTab } from "./mercado-livre-tab";
import type { Watch } from "@/generated/prisma";
import type { PublicSettings } from "./types";

const TABS = [
  { value: "deteccao", label: "Detecção de ofertas" },
  { value: "categorias", label: "Categorias monitoradas" },
  { value: "links", label: "Links e afiliado" },
  { value: "mercadolivre", label: "Mercado Livre" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const TAB_VALUES = TABS.map((t) => t.value) as readonly string[];

interface ConfiguracoesTabsProps {
  settings: PublicSettings;
  watches: Watch[];
  defaults: {
    minDiscount: number;
    hotDiscount: number;
    minHistoryPoints: number;
    minPrice: number;
    minSoldQuantity: number;
  };
}

/// Estado da aba selecionada mora na URL (?aba=...) via nuqs, então o link é
/// compartilhável e o back/forward do navegador funciona entre abas.
export function ConfiguracoesTabs({ settings, watches, defaults }: ConfiguracoesTabsProps) {
  const [tab, setTab] = useQueryState("aba", { defaultValue: "deteccao" as TabValue });
  const active = TAB_VALUES.includes(tab) ? tab : "deteccao";

  return (
    <Tabs value={active} onValueChange={(v) => setTab(String(v))}>
      <TabsList className="flex-wrap">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="deteccao" className="mt-4">
        <DeteccaoTab settings={settings} defaults={defaults} />
      </TabsContent>
      <TabsContent value="categorias" className="mt-4">
        <CategoriasTab watches={watches} globalMinDiscount={settings.minDiscount} />
      </TabsContent>
      <TabsContent value="links" className="mt-4">
        <LinksTab settings={settings} />
      </TabsContent>
      <TabsContent value="mercadolivre" className="mt-4">
        <MercadoLivreTab settings={settings} />
      </TabsContent>
    </Tabs>
  );
}
