"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinCoachWithCodeAction } from "@/lib/actions";
import { Field, Button, ErrorText } from "@/components/ui";

export function JoinCoachForm() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError(undefined);
    const formData = new FormData(form);
    const result = await joinCoachWithCodeAction(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      form.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <Field label="Code d'invitation de votre coach" name="inviteToken" placeholder="ex. a1b2c3d4" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Connexion…" : "Rejoindre"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
