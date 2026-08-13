import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { isAuthenticated } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconMarca } from "@/components/icons";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const hasError = params?.error === "1";

  return (
    // A tela de entrar fica fora do layout do painel, então os recuos de
    // recorte de câmera e faixa de gesto precisam ser tratados aqui também.
    // O max() mantém o 1rem de sempre onde não existe recorte nenhum, e o
    // min-h-svh acompanha a área realmente visível no celular.
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background p-4 pt-[max(1rem,var(--area-segura-cima))] pr-[max(1rem,var(--area-segura-dir))] pb-[max(1rem,var(--area-segura-baixo))] pl-[max(1rem,var(--area-segura-esq))]">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* O amarelo entra como preenchimento, com o símbolo em preto por cima */}
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HugeiconsIcon icon={IconMarca} size={24} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          ML Searcher
        </h1>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Acessar o painel</CardTitle>
          <CardDescription>Informe a senha de acesso para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm hasError={hasError} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Acesso restrito e protegido por senha única.</p>
    </div>
  );
}
