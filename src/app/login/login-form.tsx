"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Entrando...
        </>
      ) : (
        "Entrar"
      )}
    </Button>
  );
}

export function LoginForm({ hasError }: { hasError: boolean }) {
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoFocus
            required
            aria-invalid={hasError}
            className="pl-8"
          />
        </div>
        {hasError && (
          <p className="text-sm text-danger" role="alert">
            Senha incorreta. Tente novamente.
          </p>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}
