import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTeamsForCoach } from "@/lib/queries";
import { TEAM_SPORTS, type TeamSport } from "@/lib/team-sports";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card } from "@/components/ui";
import { CreateTeamForm } from "./create-team-form";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const teams = await getTeamsForCoach(user.id);

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/equipes" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <h1 className="mb-1 font-display text-3xl text-ink">Équipes</h1>
          <p className="mb-6 text-slate">
            Regroupez vos athlètes par équipe et par poste pour visualiser l&apos;effectif sur un terrain.
          </p>

          <div className="mb-8">
            <CreateTeamForm />
          </div>

          {teams.length === 0 ? (
            <Card className="rounded-3xl">
              <p className="text-slate">Aucune équipe pour l&apos;instant — créez-en une ci-dessus.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/coach/equipes/${t.id}`}
                  className="flex flex-col gap-1 rounded-2xl border border-line bg-white p-4 hover:border-moss"
                >
                  <span className="font-medium text-ink">{t.name}</span>
                  <span className="text-sm text-slate">
                    {TEAM_SPORTS[t.sport as TeamSport]?.label ?? t.sport} · {t.member_count} joueur
                    {t.member_count > 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
