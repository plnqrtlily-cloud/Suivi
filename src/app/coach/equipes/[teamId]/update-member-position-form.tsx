"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTeamMemberPositionAction } from "@/lib/actions";
import { TEAM_SPORTS, type TeamSport } from "@/lib/team-sports";

export function UpdateMemberPositionForm({
  memberId,
  sport,
  currentPosition,
  athleteName,
}: {
  memberId: string;
  sport: TeamSport;
  currentPosition: string;
  athleteName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <select
      defaultValue={currentPosition}
      disabled={pending}
      aria-label={`Poste de ${athleteName}`}
      className="rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-moss focus:ring-1 focus:ring-moss disabled:opacity-50"
      onChange={async (e) => {
        setPending(true);
        const result = await updateTeamMemberPositionAction(memberId, e.target.value);
        if ("error" in result) {
          alert(result.error);
          setPending(false);
          return;
        }
        router.refresh();
        setPending(false);
      }}
    >
      {TEAM_SPORTS[sport].positions.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
