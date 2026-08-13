/// Um módulo "use server" só pode exportar funções async, então o tipo e o
/// valor inicial do estado das actions moram aqui — mesmo padrão usado em
/// /configuracoes e /links.

export interface ActionState {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
  ts: number;
}

export const INITIAL_ACTION_STATE: ActionState = { ok: true, message: "", ts: 0 };

export function ok(message: string): ActionState {
  return { ok: true, message, ts: Date.now() };
}

export function fail(message: string): ActionState {
  return { ok: false, message, ts: Date.now() };
}

/// Retorno de createInstanceAction/reconnectAction: além do ok/message
/// padrão, carrega o id da instância pra tela começar a fazer polling do
/// status (QR code) sem precisar recarregar a página.
export interface InstanceActionState extends ActionState {
  instanceId?: string;
}

export const INITIAL_INSTANCE_STATE: InstanceActionState = { ok: true, message: "", ts: 0 };

export function okInstance(message: string, instanceId: string): InstanceActionState {
  return { ok: true, message, ts: Date.now(), instanceId };
}

export function failInstance(message: string): InstanceActionState {
  return { ok: false, message, ts: Date.now() };
}
