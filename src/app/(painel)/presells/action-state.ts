/// Um módulo "use server" só pode exportar funções async, então o tipo e o
/// valor inicial do estado das actions moram aqui. Exportá-los de actions.ts
/// quebrava o módulo inteiro em runtime.

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  presellId?: string;
  slug?: string;
}

export const initialActionState: ActionState = {};
