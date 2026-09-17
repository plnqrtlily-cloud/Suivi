"use client";

import { useState } from "react";
import { requestPasswordResetAction } from "@/lib/actions";
import { Field, Button } from "@/components/ui";

export function ForgotPasswordForm() {
  const [result, setResult] = useState<{ message?: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const res = await requestPasswordResetAction(formData);
    setResult(res);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email" type="email" name="email" required />
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Recevoir un lien de réinitialisation"}
        </Button>
      </form>
      {result && (
        <div className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm">
          <p>{result.message}</p>
        </div>
      )}
    </div>
  );
}
