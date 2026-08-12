"use client";

import { useFormStatus } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCarregando, IconSenha } from "@/components/icons";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <HugeiconsIcon
            icon={IconCarregando}
            size={16}
            strokeWidth={2}
            className="animate-spin"
            aria-hidden="true"
          />
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
          <HugeiconsIcon
            icon={IconSenha}
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
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
