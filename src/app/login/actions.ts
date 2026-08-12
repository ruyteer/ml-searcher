"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSession } from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");

  if (!checkPassword(password)) {
    redirect("/login?error=1");
  }

  await createSession();
  redirect("/dashboard");
}
