"use client";

import { useActionState, useState } from "react";
import { registerAction } from "@/lib/actions";
import { Field, Button, ErrorText } from "@/components/ui";

type State = { error?: string } | undefined;

export function RegisterForm({ defaultInviteToken }: { defaultInviteToken?: string }) {
  const [role, setRole] = useState<"athlete" | "coach">(defaultInviteToken ? "athlete" : "coach");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const result = await registerAction(formData);
      return result as State;
    },
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex gap-2 rounded-md border border-line p-1 text-sm">
        <button
          type="button"
          onClick={() => setRole("athlete")}
          className={`flex-1 rounded px-3 py-1.5 ${role === "athlete" ? "bg-moss text-white" : "text-ink-soft"}`}
        >
          Je suis athlète
        </button>
        <button
          type="button"
          onClick={() => setRole("coach")}
          className={`flex-1 rounded px-3 py-1.5 ${role === "coach" ? "bg-moss text-white" : "text-ink-soft"}`}
        >
          Je suis coach
        </button>
      </div>
      <input type="hidden" name="role" value={role} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Prénom" name="firstName" required />
        <Field label="Nom" name="lastName" required />
      </div>
      <Field label="Email" type="email" name="email" required autoComplete="email" />
      <Field
        label="Mot de passe (8 caractères minimum)"
        type="password"
        name="password"
        minLength={8}
        required
        autoComplete="new-password"
      />
      {role === "athlete" && (
        <Field
          label="Code d'invitation de votre coach (facultatif)"
          name="inviteToken"
          defaultValue={defaultInviteToken}
          placeholder="ex. a1b2c3d4"
        />
      )}

      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="acceptedTerms" required className="mt-0.5" />
        <span>
          J&apos;accepte les{" "}
          <a href="/legal" target="_blank" className="text-moss-dark underline">
            conditions d&apos;utilisation et la politique de confidentialité
          </a>
          , y compris le traitement de mes données de santé nécessaires au suivi (RGPD, art. 9).
        </span>
      </label>

      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
