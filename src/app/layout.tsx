import type { Metadata, Viewport } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Fonte única do painel: corpo, interface e títulos. Poppins não é variável,
// então só entram os pesos realmente usados nas classes do Tailwind:
// 400 (normal), 500 (font-medium), 600 (font-semibold), 700 (font-bold) e
// 800 (font-extrabold, usado no preço das pre-sells).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ML Searcher",
  description: "Painel de ofertas, produtos e links afiliados do Mercado Livre",
  applicationName: "ML Searcher",
  // O <link rel="manifest"> é inserido sozinho pelo Next porque existe o
  // arquivo src/app/manifest.ts. O navegador busca esse endereço sem mandar
  // cookie, então ele está liberado na lista pública de src/proxy.ts, senão
  // a instalação receberia um redirecionamento para o login.
  appleWebApp: {
    capable: true,
    title: "ML Searcher",
    /*
      Barra de status opaca e escura: o sistema reserva a faixa do relógio e
      do recorte da câmera, e a página começa logo abaixo dela.

      Antes estava "black-translucent", que faz o oposto: a página começa no
      alto de tudo e passa por baixo do recorte, e só não fica escondida se
      CADA elemento colado no topo lembrar de descer sozinho pelo valor da
      área segura. Basta um esquecer (a tela de entrar, uma folha, um
      diálogo, um aviso) para o conteúdo sumir debaixo do relógio, que foi
      exatamente a queixa. Com a faixa reservada pelo sistema, esse tipo de
      erro deixa de existir: nenhum elemento consegue ficar por baixo dela.

      O que se perde: o desenho de borda a borda no topo (nada mais pinta
      atrás do relógio) e o controle da cor daquela faixa, que passa a ser
      decidida pelo sistema a partir do themeColor abaixo. Por isso o
      themeColor acompanha exatamente o fundo do tema escuro, senão apareceria
      uma listra de tom diferente encostada no topo do painel.
    */
    statusBarStyle: "black",
  },
  formatDetection: {
    // Preço e código de produto viravam link de telefone no iPhone.
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  other: {
    // O Next já emite o nome novo (mobile-web-app-capable). O iPhone com
    // sistema mais antigo só entende este, e sem ele a barra de status
    // translúcida não vale.
    "apple-mobile-web-app-capable": "yes",
  },
};

/*
  Viewport do app.

  Nada de user-scalable=no: quem precisa ampliar a tela continua podendo. O
  zoom automático ao tocar num campo, que é o que tirava o app do quadro,
  foi resolvido pelo tamanho do texto dos campos (ver globals.css).

  viewportFit "cover" faz o conteúdo ocupar a tela inteira do iPhone,
  inclusive atrás do recorte da câmera; as áreas seguras cuidam do resto.
*/
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  /*
    Mesmo tom do --background do tema escuro (oklch(0.145 0.006 260)). É esta
    cor que o iPhone usa na faixa do relógio em app instalado, então qualquer
    diferença aqui aparece como uma listra mais clara colada no topo.
  */
  themeColor: "#090a0d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${poppins.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      {/*
        Altura mínima em svh, não na medida antiga de tela cheia: no iPhone o
        100vh conta a tela inteira, inclusive o pedaço que a barra do
        navegador cobre, então a página ficava sempre um pouco maior que a
        área visível. O svh é a menor área garantida, o valor que não muda
        quando as barras do Safari aparecem e somem, então nada dança durante
        a rolagem. Onde o elemento precisa acompanhar a área visível do
        momento, e não a garantida, o certo é dvh; aqui é o oposto, porque
        uma altura mínima que cresce e encolhe empurraria o conteúdo.
      */}
      <body className="min-h-svh antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster
            theme="dark"
            richColors
            position="top-right"
            // No celular o aviso desceria por baixo do recorte da câmera.
            mobileOffset={{ top: "calc(var(--area-segura-cima) + 0.75rem)", right: "0.75rem", left: "0.75rem" }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
