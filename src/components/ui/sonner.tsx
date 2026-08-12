"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { IconSucesso, IconInfo, IconAlerta, IconErroCirculo, IconCarregando } from "@/components/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon icon={IconSucesso} size={16} strokeWidth={1.6} aria-hidden="true" />
        ),
        info: (
          <HugeiconsIcon icon={IconInfo} size={16} strokeWidth={1.6} aria-hidden="true" />
        ),
        warning: (
          <HugeiconsIcon icon={IconAlerta} size={16} strokeWidth={1.6} aria-hidden="true" />
        ),
        error: (
          <HugeiconsIcon icon={IconErroCirculo} size={16} strokeWidth={1.6} aria-hidden="true" />
        ),
        loading: (
          <HugeiconsIcon icon={IconCarregando} size={16} strokeWidth={1.6} className="animate-spin" aria-hidden="true" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
