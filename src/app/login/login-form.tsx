"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";
import { Field, Button, ErrorText } from "@/components/ui";

type State = { error?: string } | undefined;

export function LoginForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result = await loginAction(formData);
      return result as State;
    },
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Email" type="email" name="email" required autoComplete="email" />
      <Field label="Mot de passe" type="password" name="password" required autoComplete="current-password" />
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
