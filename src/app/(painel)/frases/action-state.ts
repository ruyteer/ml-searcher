/// Um módulo "use server" só pode exportar funções async, então o tipo e o
/// valor inicial do estado das actions moram aqui. Exportá-los de actions.ts
/// quebrava o módulo inteiro em runtime.

export interface ActionState {
  success: boolean;
  message?: string;
}

export const INITIAL_ACTION_STATE: ActionState = { success: false, message: undefined };
