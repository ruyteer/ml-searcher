import type { Settings } from "@/lib/settings";

/// Forma de Settings segura pra mandar pro client: nunca inclui o secret em
/// texto puro, só se ele já está preenchido (pro placeholder mascarado).
export type PublicSettings = Omit<Settings, "mlClientSecret"> & { mlHasSecret: boolean };
