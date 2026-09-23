"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addTeamMemberAction } from "@/lib/actions";
import { Button } from "@/components/ui";
import { TEAM_SPORTS, type TeamSport } from "@/lib/team-sports";
import type { AthleteLink } from "@/lib/queries";

export function AddMemberForm({ teamId, sport, athletes }: { teamId: string; sport: TeamSport; athletes: AthleteLink[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    const formData = new FormData(form);
    formData.set("teamId", teamId);
    const result = await addTeamMemberAction(formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <select
        name="athleteId"
        required
        className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-1 focus:ring-moss"
      >
        <option value="">Choisir un athlète</option>
        {athletes.map((a) => (
          <option key={a.athlete_id} value={a.athlete_id ?? ""}>
            {a.first_name} {a.last_name}
          </option>
        ))}
      </select>
      <select
        name="position"
        required
        className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-1 focus:ring-moss"
      >
        {TEAM_SPORTS[sport].positions.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter"}
      </Button>
      {error && <p className="w-full text-sm text-clay">{error}</p>}
    </form>
  );
}
