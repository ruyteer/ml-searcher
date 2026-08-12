import type { Settings } from "@/lib/settings";

/// Estado da conexão com o Mercado Livre, na forma que pode cruzar para o
/// cliente. Só status: access token e refresh token nunca saem do servidor.
export interface MlConnectionView {
  conectado: boolean;
  nickname: string | null;
  mlUserId: string | null;
  /// ISO 8601 do vencimento do access token, ou null sem conexão.
  expiraEm: string | null;
  scope: string | null;
  /// Motivo da última falha de renovação, quando a conexão caiu sozinha.
  erro: string | null;
  /// De onde sai o token usado nas chamadas à API hoje.
  fonte: "usuario" | "aplicacao" | "nenhum";
}

/// Forma de Settings segura pra mandar pro client: nunca inclui o secret em
/// texto puro, só se ele já está preenchido (pro placeholder mascarado).
///
/// `mlAuth` e `mlRedirectUri` entram aqui (e não como props novas do
/// ConfiguracoesTabs) porque o objeto de settings já é o único canal que a
/// página usa para alimentar todas as abas.
export type PublicSettings = Omit<Settings, "mlClientSecret"> & {
  mlHasSecret: boolean;
  mlAuth: MlConnectionView;
  /// URL de redirecionamento cadastrada na aplicação do Mercado Livre.
  /// Guardada em `Setting` (key/value livre), fora do SETTINGS_SCHEMA.
  mlRedirectUri: string;
};
