import { getSettings, SETTINGS_SCHEMA } from "@/lib/settings";
import { listWatchTree } from "@/lib/data/watches";
import { PageHeader } from "@/components/shell/page-header";
import { ConfiguracoesTabs } from "./configuracoes-tabs";
import type { PublicSettings } from "./types";

export default async function ConfiguracoesPage() {
  // Árvore (pai antes das filhas) — a aba de categorias indenta por depth.
  const [settings, watches] = await Promise.all([getSettings(), listWatchTree()]);

  // O secret nunca sai do servidor em texto puro — só um booleano indicando
  // se já existe um valor salvo (pro placeholder mascarado no formulário).
  const { mlClientSecret, ...rest } = settings;
  const publicSettings: PublicSettings = { ...rest, mlHasSecret: Boolean(mlClientSecret) };

  const defaults = {
    minDiscount: SETTINGS_SCHEMA.minDiscount.default,
    hotDiscount: SETTINGS_SCHEMA.hotDiscount.default,
    minHistoryPoints: SETTINGS_SCHEMA.minHistoryPoints.default,
    minPrice: SETTINGS_SCHEMA.minPrice.default,
    minSoldQuantity: SETTINGS_SCHEMA.minSoldQuantity.default,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Tudo que controla o comportamento do sistema: desconto mínimo, categorias monitoradas, links e credenciais do Mercado Livre. Nada aqui fica fixo no código."
      />
      <ConfiguracoesTabs settings={publicSettings} watches={watches} defaults={defaults} />
    </div>
  );
}
