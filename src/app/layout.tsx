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
    // Barra de status escura e translúcida, com o conteúdo passando por
    // baixo dela. Quem cuida do espaço é o env(safe-area-inset-top).
    statusBarStyle: "black-translucent",
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
  themeColor: "#131317",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${poppins.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
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
