"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeamAction } from "@/lib/actions";
import { Field, SelectField, Button } from "@/components/ui";
import { TEAM_SPORT_VALUES, TEAM_SPORTS } from "@/lib/team-sports";

export function CreateTeamForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    const formData = new FormData(form);
    const result = await createTeamAction(formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    form.reset();
    router.push(`/coach/equipes/${result.teamId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="w-full sm:w-auto sm:flex-1">
        <Field label="Nom de l'équipe" name="name" placeholder="ex. U15, Senior..." required />
      </div>
      <div className="w-full sm:w-auto">
        <SelectField label="Sport" name="sport" defaultValue={TEAM_SPORT_VALUES[0]}>
          {TEAM_SPORT_VALUES.map((s) => (
            <option key={s} value={s}>
              {TEAM_SPORTS[s].label}
            </option>
          ))}
        </SelectField>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer l'équipe"}
      </Button>
      {error && <p className="w-full text-sm text-clay">{error}</p>}
    </form>
  );
}
