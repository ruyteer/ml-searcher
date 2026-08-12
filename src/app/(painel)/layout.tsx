import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAuthenticated } from "@/lib/auth";
import { SidebarProvider } from "@/components/shell/sidebar-context";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { Topbar } from "@/components/shell/topbar";
import { findActiveNavItem } from "@/components/shell/nav-items";

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

  return (
    <SidebarProvider>
      <div className="nav-progress-bar" aria-hidden="true" />
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-h-screen w-full flex-1 flex-col">
          <Topbar>{title}</Topbar>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
