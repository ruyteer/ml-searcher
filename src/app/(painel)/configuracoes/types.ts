import type { Settings } from "@/lib/settings";

/// Estado da conexão com o Mercado Livre, na forma que pode cruzar para o
/// cliente. Só o necessário pra tela: acesso e refresh token nunca saem do
/// servidor, e detalhe técnico (permissões, id numérico, validade exata)
/// fica de fora — a tela só precisa saber se está conectado e com quem.
export interface MlConnectionView {
  conectado: boolean;
  nickname: string | null;
  /// Motivo da última falha de renovação, quando a conexão caiu sozinha.
  erro: string | null;
  /// De onde sai o acesso usado nas chamadas à API hoje.
  fonte: "usuario" | "aplicacao" | "nenhum";
}

/// Forma de Settings segura pra mandar pro client: nunca inclui o secret em
/// texto puro, só se ele já está preenchido (pro placeholder mascarado).
///
/// `mlAuth` entra aqui (e não como prop nova do ConfiguracoesTabs) porque o
/// objeto de settings já é o único canal que a página usa para alimentar
/// todas as abas.
export type PublicSettings = Omit<Settings, "mlClientSecret"> & {
  mlHasSecret: boolean;
  mlAuth: MlConnectionView;
};
