import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAthletesForCoach, getWorkoutsForAthlete, getImportedActivitiesForRange, getRecentCheckins } from "@/lib/queries";
import { computeAcwr } from "@/lib/training-stats";
import { todayISO, toISODate, daysUntil } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { InviteForm } from "./invite-form";
import { RevokeButton } from "./revoke-button";
import { BroadcastMessageModal } from "./broadcast-message-modal";

interface RosterSignals {
  acwrHighRisk: boolean;
  daysSinceCheckin: number | null;
  missedRecently: number;
}

// Signaux à traiter en priorité — plutôt qu'une simple liste de noms, faire
// remonter qui a besoin d'attention avant de cliquer sur chaque fiche une
// par une : pertinent dès qu'un coach suit plus de quelques athlètes.
async function getRosterSignals(athleteId: string, today: string): Promise<RosterSignals> {
  const acwrFrom = new Date();
  acwrFrom.setDate(acwrFrom.getDate() - 27);
  const acwrFromISO = toISODate(acwrFrom);
  const recentFrom = new Date();
  recentFrom.setDate(recentFrom.getDate() - 13);
  const recentFromISO = toISODate(recentFrom);

  const [workouts, acwrImports, recentCheckins] = await Promise.all([
    getWorkoutsForAthlete(athleteId),
    getImportedActivitiesForRange(athleteId, acwrFromISO, today),
    getRecentCheckins(athleteId, 1),
  ]);

  const acwr = computeAcwr(workouts, acwrImports, today);
  const lastCheckin = recentCheckins[0];
  const missedRecently = workouts.filter((w) => w.date >= recentFromISO && w.date <= today && w.status === "not_done").length;

  return {
    acwrHighRisk: acwr.status === "high_risk",
    daysSinceCheckin: lastCheckin ? -daysUntil(lastCheckin.check_date) : null,
    missedRecently,
  };
}

export default async function CoachDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const links = await getAthletesForCoach(user.id);
  const active = links.filter((l) => l.status === "active");
  const pending = links.filter((l) => l.status === "pending");

  const today = todayISO();
  const signalsByAthlete = new Map<string, RosterSignals>(
    await Promise.all(
      active.map(async (l) => [l.athlete_id!, await getRosterSignals(l.athlete_id!, today)] as const)
    )
  );
  // Athlètes avec un signal à traiter en premier — dans l'ordre : charge à
  // risque, forme non renseignée depuis longtemps, séances manquées.
  const sortedActive = [...active].sort((a, b) => {
    const sa = signalsByAthlete.get(a.athlete_id!);
    const sb = signalsByAthlete.get(b.athlete_id!);
    const scoreOf = (s?: RosterSignals) =>
      !s ? 0 : (s.acwrHighRisk ? 4 : 0) + (s.missedRecently > 0 ? 2 : 0) + (s.daysSinceCheckin !== null && s.daysSinceCheckin > 3 ? 1 : 0);
    return scoreOf(sb) - scoreOf(sa);
  });

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mb-1 font-display text-3xl text-ink">Mes athlètes</h1>
            <p className="text-slate">
              {active.length} athlète{active.length === 1 ? "" : "s"} suivi{active.length === 1 ? "" : "s"}
            </p>
          </div>
          <BroadcastMessageModal athleteCount={active.length} />
        </div>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Inviter un athlète</h2>
          <InviteForm />
        </Card>

        <div className="grid gap-3">
          {sortedActive.map((link) => {
            const signals = signalsByAthlete.get(link.athlete_id!);
            return (
              <Link key={link.link_id} href={`/coach/athletes/${link.athlete_id}`}>
                <Card className="flex items-center justify-between rounded-2xl transition-colors hover:border-moss">
                  <div className="flex items-center gap-3">
                    <Avatar userId={link.athlete_id!} firstName={link.first_name || "?"} hasAvatar={!!link.avatar_path} />
                    <div>
                      <p className="font-medium text-ink">
                        {link.first_name} {link.last_name}
                      </p>
                      <p className="text-sm text-slate">{link.email}</p>
                      {signals && (signals.acwrHighRisk || signals.missedRecently > 0 || (signals.daysSinceCheckin !== null && signals.daysSinceCheckin > 3)) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {signals.acwrHighRisk && (
                            <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-clay">
                              Charge en forte hausse
                            </span>
                          )}
                          {signals.missedRecently > 0 && (
                            <span className="rounded-full bg-status-postponed/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-postponed">
                              {signals.missedRecently} séance{signals.missedRecently > 1 ? "s" : ""} non réalisée{signals.missedRecently > 1 ? "s" : ""}
                            </span>
                          )}
                          {signals.daysSinceCheckin !== null && signals.daysSinceCheckin > 3 && (
                            <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate">
                              Forme non renseignée depuis {signals.daysSinceCheckin} j
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-moss-dark">Voir le suivi →</span>
                </Card>
              </Link>
            );
          })}

          {pending.map((link) => (
            <Card key={link.link_id} className="flex items-center justify-between rounded-2xl bg-paper-dim">
              <div>
                <p className="font-medium text-ink-soft">Invitation en attente</p>
                <p className="text-sm text-slate">{link.invite_email || "Lien partagé sans email précisé"}</p>
              </div>
              <RevokeButton linkId={link.link_id} label="Annuler" />
            </Card>
          ))}

          {active.length === 0 && pending.length === 0 && (
            <Card className="rounded-2xl text-center text-slate">
              Aucun athlète pour l&apos;instant — générez un lien d&apos;invitation ci-dessus.
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
