import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { isAuthenticated } from "@/lib/auth";
import { SidebarProvider } from "@/components/shell/sidebar-context";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Topbar } from "@/components/shell/topbar";
import { findActiveNavItem } from "@/components/shell/nav-items";
import { InstalarApp, RegistrarSW } from "@/components/pwa";

interface PainelLayoutProps {
  children: React.ReactNode;
}

export default async function PainelLayout({ children }: PainelLayoutProps) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  // O pathname vem do header injetado pelo middleware, então o título do
  // topbar já sai correto no primeiro render do servidor (sem esperar por
  // um efeito no cliente).
  const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
  const title = findActiveNavItem(pathname)?.label ?? "Painel";

  // NuqsAdapter fica aqui, uma vez só: todas as páginas do painel guardam
  // filtro e aba na URL.
  return (
    <NuqsAdapter>
      <SidebarProvider>
        <div className="nav-progress-bar" aria-hidden="true" />
        <div className="flex min-h-svh w-full">
          <AppSidebar />
          <div className="flex min-h-svh w-full min-w-0 flex-1 flex-col">
            <Topbar>{title}</Topbar>
            {/*
              O recuo de baixo no celular abre espaço para a barra de
              navegação fixa e para a faixa de gesto do aparelho, senão o
              último item da lista fica escondido atrás dela.
            */}
            <main className="min-w-0 flex-1 px-3 pt-4 pb-[calc(var(--altura-barra-inferior)+var(--area-segura-baixo)+1rem)] md:p-6 md:pb-6">
              {children}
            </main>
          </div>
        </div>
        <BottomNav />
        <MobileNav />
        <RegistrarSW />
        <InstalarApp />
      </SidebarProvider>
    </NuqsAdapter>
  );
}
