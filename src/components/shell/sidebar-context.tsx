"use client";

import * as React from "react";

const COLLAPSED_STORAGE_KEY = "mls_sidebar_collapsed";

interface SidebarContextValue {
  /// Sidebar recolhida (desktop, mostra só ícones).
  collapsed: boolean;
  toggleCollapsed: () => void;
  /// Sheet de navegação aberta (mobile).
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

// Preferência de collapse persistida em localStorage, exposta via
// useSyncExternalStore: no server (e no primeiro paint do client, antes da
// hidratação assentar) sempre "expandida" — sem isso teríamos que sincronizar
// com setState dentro de um useEffect, o que causa uma renderização em cascata.
type Listener = () => void;
const listeners = new Set<Listener>();
let collapsedCache = false;

if (typeof window !== "undefined") {
  collapsedCache = window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return collapsedCache;
}

function getServerSnapshot() {
  return false;
}

function persistCollapsed(next: boolean) {
  collapsedCache = next;
  window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
  for (const listener of listeners) listener();
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const collapsed = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleCollapsed = React.useCallback(() => {
    persistCollapsed(!collapsedCache);
  }, []);

  const value = React.useMemo<SidebarContextValue>(
    () => ({ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, toggleCollapsed, mobileOpen]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar deve ser usado dentro de <SidebarProvider>");
  return ctx;
}
