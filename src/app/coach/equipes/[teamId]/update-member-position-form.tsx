"use client";

import { useRouter } from "next/navigation";
import { updateTeamMemberPositionAction } from "@/lib/actions";
import { TEAM_SPORTS, type TeamSport } from "@/lib/team-sports";

export function UpdateMemberPositionForm({
  memberId,
  sport,
  currentPosition,
}: {
  memberId: string;
  sport: TeamSport;
  currentPosition: string;
}) {
  const router = useRouter();
  return (
    <select
      defaultValue={currentPosition}
      className="rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-moss focus:ring-1 focus:ring-moss"
      onChange={async (e) => {
        const result = await updateTeamMemberPositionAction(memberId, e.target.value);
        if ("error" in result) {
          alert(result.error);
          return;
        }
        router.refresh();
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
