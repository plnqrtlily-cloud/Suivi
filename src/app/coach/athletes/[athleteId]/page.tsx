import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import {
  getAthletesForCoach,
  getWorkoutsForAthlete,
  getLatestMeasurements,
  getInjuriesForAthlete,
  getJournalForAthlete,
  getRecentCheckins,
  getUserGender,
  getUserAvatar,
  getUpcomingGoals,
} from "@/lib/queries";
import { UpcomingGoals } from "@/components/upcoming-goals";
import { getCycleSettings, estimateCyclePhase, PHASE_LABELS } from "@/lib/cycle";
import { computeGlobalScore, scoreLabel, scoreColor } from "@/lib/checkin-types";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, LinkButton, sportLabel } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { RevokeButton } from "@/app/coach/revoke-button";

const METRIC_LABELS: Record<string, string> = {
  weight_kg: "Poids (kg)",
  height_cm: "Taille (cm)",
  fc_repos: "FC repos (bpm)",
  fc_max: "FC max (bpm)",
  vo2max: "VO2max",
  ftp: "FTP (W)",
  pma_vma: "PMA/VMA",
};

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId } = await params;

  // Garde de permission (cf. prompt : règle la plus critique du produit).
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) {
    notFound();
  }

  const athlete = await findUserById(athleteId);
  if (!athlete) notFound();
  const athleteAvatar = await getUserAvatar(athleteId);

  const links = await getAthletesForCoach(user.id);
  const link = links.find((l) => l.athlete_id === athleteId);

  const today = new Date().toISOString().slice(0, 10);
  const allWorkouts = await getWorkoutsForAthlete(athleteId);
  const workouts = allWorkouts.filter((w) => w.date >= today).slice(0, 10);
  const pastWorkouts = allWorkouts.filter((w) => w.date < today).slice(-5).reverse();
  const measurements = await getLatestMeasurements(athleteId);
  const injuries = await getInjuriesForAthlete(athleteId);
  const journalAll = await getJournalForAthlete(athleteId);
  const journal = journalAll.slice(0, 3);
  const cycleSettings = await getCycleSettings(athleteId);
  const athleteGender = await getUserGender(athleteId);
  const cycleEstimate =
    athleteGender === "female" && cycleSettings.share_with_coaches ? await estimateCyclePhase(athleteId) : null;
  const recentCheckins = await getRecentCheckins(athleteId, 1);
  const latestCheckin = recentCheckins[0];
  const upcomingGoals = await getUpcomingGoals(athleteId);

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar userId={athleteId} firstName={athlete.first_name} hasAvatar={!!athleteAvatar?.avatar_path} size="lg" />
            <div>
              <h1 className="font-display text-3xl text-ink">
                {athlete.first_name} {athlete.last_name}
              </h1>
              <p className="text-slate">{athlete.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <LinkButton href={`/coach/athletes/${athleteId}/new-workout`}>+ Nouvelle séance</LinkButton>
            <LinkButton href={`/coach/athletes/${athleteId}/messages`} variant="secondary">
              💬 Discuter
            </LinkButton>
            {link && <RevokeButton linkId={link.link_id} label="Retirer cet athlète" />}
          </div>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Statistiques de performance</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <div key={key}>
                  <dt className="text-slate">{label}</dt>
                  <dd className="font-medium text-ink">{measurements[key]?.value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {cycleEstimate && (
            <Card>
              <h2 className="mb-3 text-sm font-medium text-ink-soft">Cycle menstruel</h2>
              <p className="font-medium text-ink">{PHASE_LABELS[cycleEstimate.phase]}</p>
              {cycleEstimate.dayOfCycle && <p className="text-sm text-slate">Jour {cycleEstimate.dayOfCycle} du cycle</p>}
              <p className="mt-2 text-xs text-slate">Partagé volontairement par l&apos;athlète — détail des entrées non visible.</p>
            </Card>
          )}

          {latestCheckin && (
            <Card>
              <h2 className="mb-3 text-sm font-medium text-ink-soft">Forme du jour</h2>
              {(() => {
                const score = computeGlobalScore(latestCheckin);
                return (
                  <p className={`text-lg font-semibold ${scoreColor(score)}`}>
                    {score}/10 · {scoreLabel(score)}
                  </p>
                );
              })()}
              <p className="text-xs text-slate">Relevé le {latestCheckin.check_date}</p>
              {latestCheckin.notes && <p className="mt-1 text-sm text-ink-soft">{latestCheckin.notes}</p>}
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Antécédents de blessures</h2>
            {injuries.length === 0 && <p className="text-sm text-slate">Aucun antécédent renseigné.</p>}
            <ul className="space-y-2 text-sm">
              {injuries.slice(0, 4).map((i) => (
                <li key={i.id}>
                  <span className="font-medium text-ink">{i.zone}</span>{" "}
                  <span className="text-slate">
                    ({i.date_start}
                    {i.date_end ? ` → ${i.date_end}` : ""})
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Journal de bord récent</h2>
            {journal.length === 0 && <p className="text-sm text-slate">Aucune entrée pour l&apos;instant.</p>}
            <ul className="space-y-2 text-sm">
              {journal.map((j) => (
                <li key={j.id}>
                  <span className="text-slate">{j.entry_date} — </span>
                  <span className="text-ink">{j.content.slice(0, 80)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <h2 className="mb-3 font-display text-xl text-ink">Prochains objectifs</h2>
        <div className="mb-8">
          <UpcomingGoals goals={upcomingGoals} />
        </div>

        <h2 className="mb-3 font-display text-xl text-ink">Séances à venir</h2>
        <div className="mb-8 grid gap-2">
          {workouts.length === 0 && <p className="text-sm text-slate">Aucune séance planifiée.</p>}
          {workouts.map((w) => (
            <Link key={w.id} href={`/workouts/${w.id}`}>
              <Card className="flex items-center justify-between hover:border-moss">
                <div>
                  <p className="font-medium text-ink">{w.title}</p>
                  <p className="text-sm text-slate">
                    {w.date} {w.time ? `à ${w.time}` : ""} · {sportLabel(w.sport)}
                  </p>
                </div>
                <StatusBadge status={w.status} />
              </Card>
            </Link>
          ))}
        </div>

        <h2 className="mb-3 font-display text-xl text-ink">Séances récentes</h2>
        <div className="grid gap-2">
          {pastWorkouts.length === 0 && <p className="text-sm text-slate">Pas encore d&apos;historique.</p>}
          {pastWorkouts.map((w) => (
            <Link key={w.id} href={`/workouts/${w.id}`}>
              <Card className="flex items-center justify-between hover:border-moss">
                <div>
                  <p className="font-medium text-ink">{w.title}</p>
                  <p className="text-sm text-slate">
                    {w.date} · {sportLabel(w.sport)}
                    {w.rpe ? ` · RPE ${w.rpe}/10` : ""}
                  </p>
                </div>
                <StatusBadge status={w.status} />
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
