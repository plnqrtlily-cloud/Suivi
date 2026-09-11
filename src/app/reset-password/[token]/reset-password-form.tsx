"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions";
import { Field, Button, ErrorText } from "@/components/ui";

type State = { error?: string } | undefined;

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const result = await resetPasswordAction(formData);
    return result as State;
  }, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Nouveau mot de passe (8 caractères minimum)" type="password" name="password" minLength={8} required />
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Réinitialiser le mot de passe"}
      </Button>
    </form>
  );
}
