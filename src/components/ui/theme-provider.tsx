"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

/// Wrapper client-only em torno do next-themes, para poder ser importado
/// direto no layout raiz (Server Component) sem virar "use client" também.
function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export { ThemeProvider }
