import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <span className="text-lg font-semibold">ML</span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">ML Searcher</h1>
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
