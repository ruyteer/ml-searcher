import {
  type AppIcon,
  IconConfiguracoes,
  IconConfiguracoesAlt,
  IconFrases,
  IconFrasesAlt,
  IconLinks,
  IconLinksAlt,
  IconOfertas,
  IconOfertasAlt,
  IconPresells,
  IconPresellsAlt,
  IconProdutos,
  IconProdutosAlt,
  IconVisaoGeral,
  IconVisaoGeralAlt,
  IconWhatsapp,
  IconWhatsappAlt,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: AppIcon;
  /// Segunda variante do mesmo ícone, exibida no hover e no item ativo.
  iconAlt: AppIcon;
  /// Item ainda não liberado. Recebe um selo "em breve" e continua clicável (404 por ora).
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: IconVisaoGeral, iconAlt: IconVisaoGeralAlt },
  { href: "/ofertas", label: "Ofertas", icon: IconOfertas, iconAlt: IconOfertasAlt },
  { href: "/produtos", label: "Produtos", icon: IconProdutos, iconAlt: IconProdutosAlt },
  { href: "/links", label: "Links", icon: IconLinks, iconAlt: IconLinksAlt },
  { href: "/presells", label: "Pre-sells", icon: IconPresells, iconAlt: IconPresellsAlt },
  { href: "/frases", label: "Frases", icon: IconFrases, iconAlt: IconFrasesAlt },
  {
    href: "/whatsapp",
    label: "WhatsApp",
    icon: IconWhatsapp,
    iconAlt: IconWhatsappAlt,
    comingSoon: true,
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: IconConfiguracoes,
    iconAlt: IconConfiguracoesAlt,
  },
];

/// Encontra o item de navegação cujo href melhor casa com o pathname atual
/// (prefixo mais longo), usado pelo topbar para exibir o título da página.
export function findActiveNavItem(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
