import type { Metadata } from "next";
import { Space_Grotesk, Inter_Tight, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Corpo e interface. Inter Tight é estreita, então cabe mais informação por
// linha em tabela e card sem ficar apertada de ler.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

// Títulos, valores de métrica e números grandes. Space Grotesk tem recorte
// técnico e um pouco de atitude, que combina com oferta e velocidade.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${interTight.variable} ${spaceGrotesk.variable} ${geistMono.variable}`}
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
          <Toaster theme="dark" richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
