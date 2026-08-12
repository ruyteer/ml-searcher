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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
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
