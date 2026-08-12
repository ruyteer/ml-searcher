import {
  LayoutDashboard,
  Tag,
  Package,
  Link2,
  FileText,
  MessageSquareQuote,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /// Item ainda não liberado — recebe um badge "em breve" e continua clicável (404 por ora).
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/ofertas", label: "Ofertas", icon: Tag },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/links", label: "Links", icon: Link2 },
  { href: "/presells", label: "Pre-sells", icon: FileText },
  { href: "/frases", label: "Frases", icon: MessageSquareQuote },
  { href: "/whatsapp", label: "WhatsApp", icon: Send, comingSoon: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

/// Encontra o item de navegação cujo href melhor casa com o pathname atual
/// (prefixo mais longo), usado pelo topbar para exibir o título da página.
export function findActiveNavItem(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
