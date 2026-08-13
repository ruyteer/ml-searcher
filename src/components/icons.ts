/**
 * Catálogo de ícones da aplicação (HugeIcons).
 *
 * Toda tela importa daqui, nunca direto de "@hugeicons/core-free-icons".
 * Assim o vocabulário visual fica em um lugar só e trocar um ícone é uma
 * linha, não uma varredura no projeto.
 *
 * Como usar:
 *
 *   import { HugeiconsIcon } from "@hugeicons/react";
 *   import { IconOfertas } from "@/components/icons";
 *
 *   <HugeiconsIcon icon={IconOfertas} size={20} strokeWidth={1.6} />
 *
 * A cor vem de currentColor, então basta aplicar text-* no elemento pai.
 * Os pares com sufixo "Alt" existem para a prop altIcon/showAlt da lib,
 * usada como estado de hover e de item ativo na navegação.
 */
import type { IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  AlertCircleIcon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  Award01Icon,
  BoxesIcon,
  Calendar03Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  Copy02Icon,
  CursorPointer01Icon,
  DashboardSquare01Icon,
  DashboardSquare02Icon,
  Delete02Icon,
  DiscountTag01Icon,
  DiscountTag02Icon,
  Download01Icon,
  Edit02Icon,
  File02Icon,
  FilterIcon,
  FlameIcon,
  FlashIcon,
  Image02Icon,
  ImageNotFound01Icon,
  InboxIcon,
  InformationCircleIcon,
  Link01Icon,
  Link04Icon,
  LinkSquare01Icon,
  Loading03Icon,
  Logout03Icon,
  Menu01Icon,
  Money01Icon,
  MoreHorizontalIcon,
  PackageIcon,
  PackageOpenIcon,
  PackageRemoveIcon,
  PackageSearchIcon,
  PercentIcon,
  PlusSignIcon,
  PowerIcon,
  PowerOffIcon,
  QuoteDownIcon,
  QuoteDownSquareIcon,
  RefreshIcon,
  ScanIcon,
  Search01Icon,
  SearchRemoveIcon,
  Settings01Icon,
  Settings02Icon,
  Share08Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  Sorting05Icon,
  SquareLock01Icon,
  Tick02Icon,
  Unlink02Icon,
  UserGroupIcon,
  ViewIcon,
  ViewOffIcon,
  WebDesign01Icon,
  WebDesign02Icon,
  WhatsappBusinessIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";

/** Tipo de qualquer ícone deste arquivo, aceito pela prop `icon` do HugeiconsIcon. */
export type AppIcon = IconSvgElement;

/* Marca ------------------------------------------------------------------ */

/** Símbolo do produto (raio, de oferta relâmpago). */
export const IconMarca: AppIcon = FlashIcon;

/* Navegação principal ----------------------------------------------------- */

export const IconVisaoGeral: AppIcon = DashboardSquare01Icon;
export const IconVisaoGeralAlt: AppIcon = DashboardSquare02Icon;

export const IconOfertas: AppIcon = DiscountTag01Icon;
export const IconOfertasAlt: AppIcon = DiscountTag02Icon;

export const IconProdutos: AppIcon = PackageIcon;
export const IconProdutosAlt: AppIcon = PackageOpenIcon;

export const IconLinks: AppIcon = Link01Icon;
export const IconLinksAlt: AppIcon = Link04Icon;

export const IconPresells: AppIcon = WebDesign01Icon;
export const IconPresellsAlt: AppIcon = WebDesign02Icon;

export const IconFrases: AppIcon = QuoteDownIcon;
export const IconFrasesAlt: AppIcon = QuoteDownSquareIcon;

export const IconWhatsapp: AppIcon = WhatsappIcon;
export const IconWhatsappAlt: AppIcon = WhatsappBusinessIcon;

export const IconConfiguracoes: AppIcon = Settings01Icon;
export const IconConfiguracoesAlt: AppIcon = Settings02Icon;

/* Ações ------------------------------------------------------------------- */

export const IconBuscar: AppIcon = Search01Icon;
export const IconCopiar: AppIcon = Copy01Icon;
export const IconSair: AppIcon = Logout03Icon;
export const IconMenu: AppIcon = Menu01Icon;
export const IconRecolher: AppIcon = SidebarLeft01Icon;
export const IconExpandir: AppIcon = SidebarRight01Icon;
export const IconAdicionar: AppIcon = PlusSignIcon;
export const IconEditar: AppIcon = Edit02Icon;
export const IconExcluir: AppIcon = Delete02Icon;
export const IconAtualizar: AppIcon = RefreshIcon;
export const IconFiltrar: AppIcon = FilterIcon;
export const IconOrdenar: AppIcon = Sorting05Icon;
export const IconVer: AppIcon = ViewIcon;
export const IconOcultar: AppIcon = ViewOffIcon;
export const IconAbrirFora: AppIcon = LinkSquare01Icon;
export const IconCompartilhar: AppIcon = Share08Icon;
export const IconBaixar: AppIcon = Download01Icon;
export const IconFechar: AppIcon = Cancel01Icon;
export const IconConfirmar: AppIcon = Tick02Icon;
export const IconMaisOpcoes: AppIcon = MoreHorizontalIcon;
export const IconSenha: AppIcon = SquareLock01Icon;

/* Estados e feedback ------------------------------------------------------ */

export const IconCarregando: AppIcon = Loading03Icon;
export const IconSucesso: AppIcon = CheckmarkCircle02Icon;
export const IconAlerta: AppIcon = Alert02Icon;
export const IconErro: AppIcon = AlertCircleIcon;
export const IconInfo: AppIcon = InformationCircleIcon;
export const IconNadaAqui: AppIcon = InboxIcon;

/* Dados e métricas -------------------------------------------------------- */

export const IconSubindo: AppIcon = ArrowUp01Icon;
export const IconDescendo: AppIcon = ArrowDown01Icon;
export const IconGrafico: AppIcon = Analytics01Icon;
export const IconCliques: AppIcon = CursorPointer01Icon;
export const IconDesconto: AppIcon = PercentIcon;
export const IconPreco: AppIcon = Money01Icon;
export const IconRelogio: AppIcon = Clock01Icon;
export const IconCalendario: AppIcon = Calendar03Icon;
export const IconImagem: AppIcon = Image02Icon;
export const IconSemImagem: AppIcon = ImageNotFound01Icon;

/* Navegação em listas e menus ---------------------------------------------- */

/** Seta de submenu (dropdown), aponta para onde o submenu abre. */
export const IconSubmenu: AppIcon = ArrowRight01Icon;
/** Chevron do select/combobox fechado ou do botão "rolar pra baixo". */
export const IconChevronBaixo: AppIcon = ArrowDown01Icon;
/** Chevron do select/combobox aberto ou do botão "rolar pra cima". */
export const IconChevronCima: AppIcon = ArrowUp01Icon;
/** Marca de seleção (checkbox, item de menu marcado, opção do select). */
export const IconMarcado: AppIcon = Tick02Icon;
/** Cabeçalho de coluna ordenável, sem direção ativa ainda. */
export const IconOrdenarColuna: AppIcon = ArrowUpDownIcon;

/* Estados adicionais -------------------------------------------------------- */

/** Erro em círculo (slug indisponível, teste de conexão falhou etc.). */
export const IconErroCirculo: AppIcon = CancelCircleIcon;
/** Nenhum resultado para a busca feita. */
export const IconSemResultado: AppIcon = SearchRemoveIcon;
/** Nenhum produto encontrado com os filtros atuais. */
export const IconProdutoVazio: AppIcon = PackageRemoveIcon;
/** Nenhuma oferta encontrada com os filtros atuais. */
export const IconOfertaVazia: AppIcon = PackageSearchIcon;

/* Ações adicionais ----------------------------------------------------------- */

export const IconLigar: AppIcon = PowerIcon;
export const IconDesligar: AppIcon = PowerOffIcon;
export const IconDuplicar: AppIcon = Copy02Icon;
export const IconDesvincular: AppIcon = Unlink02Icon;
export const IconDocumento: AppIcon = File02Icon;

/* Métricas adicionais --------------------------------------------------------- */

/** Destaque de "em alta" (melhor desconto do momento). */
export const IconEmAlta: AppIcon = FlameIcon;
/** Total de itens em estoque/monitorados. */
export const IconEstoque: AppIcon = BoxesIcon;
/** Troféu (item campeão de um ranking). */
export const IconTrofeu: AppIcon = Award01Icon;
/** Varredura/coleta em execução ou concluída. */
export const IconVarredura: AppIcon = ScanIcon;
/** Pessoas (cliques únicos, usuários). */
export const IconUsuarios: AppIcon = UserGroupIcon;
/** Grupos de WhatsApp que recebem as ofertas. */
export const IconGrupos: AppIcon = UserGroupIcon;
