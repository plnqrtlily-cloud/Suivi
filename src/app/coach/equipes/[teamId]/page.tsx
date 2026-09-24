import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAthletesForCoach, getTeamWithMembers } from "@/lib/queries";
import { TEAM_SPORTS, type TeamSport } from "@/lib/team-sports";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card } from "@/components/ui";
import { TeamPitch } from "@/components/team-pitch";
import { TeamHeaderActions } from "./team-header-actions";
import { TeamSessionForm } from "./team-session-form";
import { UpdateMemberPositionForm } from "./update-member-position-form";
import { RemoveMemberButton } from "./remove-member-button";
import { AddMemberForm } from "./add-member-form";

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { teamId } = await params;
  const [team, links] = await Promise.all([getTeamWithMembers(teamId, user.id), getAthletesForCoach(user.id)]);
  if (!team) notFound();

  const sport = team.sport as TeamSport;
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);
  const availableAthletes = activeAthletes.filter(
    (a) => !team.members.some((m) => m.athlete_id === a.athlete_id)
  );

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/equipes" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mb-1 font-display text-3xl text-ink">{team.name}</h1>
              <p className="text-slate">{TEAM_SPORTS[sport].label}</p>
            </div>
            <TeamHeaderActions teamId={team.id} currentName={team.name} />
          </div>

          <div className="mb-8">
            <TeamPitch
              sport={sport}
              members={team.members.map((m) => ({
                athleteId: m.athlete_id,
                firstName: m.first_name,
                avatarPath: m.avatar_path,
                position: m.position,
              }))}
            />
          </div>

          {team.members.length > 0 && (
            <Card className="mb-6 rounded-3xl">
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">
                Programmer une séance pour l&apos;équipe
              </h2>
              <TeamSessionForm teamId={team.id} teamName={team.name} />
            </Card>
          )}

          <Card className="mb-6 rounded-3xl">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Effectif</h2>
            {team.members.length === 0 ? (
              <p className="text-sm text-slate">Aucun joueur pour l&apos;instant — ajoutez-en un ci-dessous.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {team.members.map((m) => (
                  <div key={m.member_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line p-3">
                    <span className="font-medium text-ink">
                      {m.first_name} {m.last_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <UpdateMemberPositionForm
                        memberId={m.member_id}
                        sport={sport}
                        currentPosition={m.position}
                        athleteName={`${m.first_name} ${m.last_name}`}
                      />
                      <RemoveMemberButton memberId={m.member_id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-3xl">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Ajouter un athlète</h2>
            {availableAthletes.length === 0 ? (
              <p className="text-sm text-slate">
                Tous vos athlètes actifs font déjà partie de cette équipe, ou vous n&apos;en avez aucun.
              </p>
            ) : (
              <AddMemberForm teamId={team.id} sport={sport} athletes={availableAthletes} />
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
