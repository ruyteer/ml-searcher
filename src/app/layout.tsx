import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ML Searcher",
  description: "Painel de ofertas, produtos e links afiliados do Mercado Livre",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${inter.variable} ${geistMono.variable}`}
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
