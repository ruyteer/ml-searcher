import type { Metadata } from "next";
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
          <Toaster theme="dark" richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
