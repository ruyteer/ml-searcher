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
              O recuo de baixo no celular reserva exatamente a altura da
              barra de navegação fixa (linha de ícones + recuo da faixa de
              gesto, a mesma conta que a barra usa), mais um respiro de
              1rem. Reservar o valor cru da área segura aqui, como estava
              antes, sobrava espaço em relação à barra e dava a impressão de
              vão embaixo da lista.

              Recuos laterais por lado, sem atalho: em tela deitada o
              recorte da câmera come a lateral, e o max() garante os 0.75rem
              de sempre quando não existe recorte nenhum.
            */}
            <main className="min-w-0 flex-1 pt-4 pr-[max(0.75rem,var(--area-segura-dir))] pb-[calc(var(--altura-barra-inferior-total)+1rem)] pl-[max(0.75rem,var(--area-segura-esq))] md:pt-6 md:pr-6 md:pb-6 md:pl-6">
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
