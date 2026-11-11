"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinCoachWithCodeAction } from "@/lib/actions";
import { Field, Button, ErrorText } from "@/components/ui";

export function JoinCoachForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(initialError);
  const [done, setDone] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError(undefined);
    setDone(undefined);
    try {
      const result = await joinCoachWithCodeAction(new FormData(form));
      if ("error" in result) {
        setError(result.error);
      } else {
        setDone(result.already ? `Tu es déjà suivi·e par ${result.coachName}.` : `C'est fait : ${result.coachName} est maintenant ton coach.`);
        form.reset();
        router.refresh();
      }
    } catch {
      setError("La liaison a échoué. Réessaie dans un instant.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Code de ton coach ou lien d'invitation" name="inviteToken" placeholder="ex. 3F9A1C2B" required autoComplete="off" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Connexion…" : "Rejoindre"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {done && <p className="text-sm font-semibold text-moss-dark">{done}</p>}
      <p className="text-xs text-slate">Ton coach trouve son code dans ses Paramètres ou dans « Inviter un athlète ».</p>
    </form>
  );
}
