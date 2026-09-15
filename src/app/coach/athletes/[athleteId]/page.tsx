import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import {
  getAthletesForCoach,
  getWorkoutsForAthlete,
  getLatestMeasurements,
  getMeasurementsForAthlete,
  getInjuriesForAthlete,
  getJournalForAthlete,
  getRecentCheckins,
  getUserGender,
  getAthleteSports,
  getCoachNotes,
  getUserAvatar,
  getUpcomingGoals,
  getImportedActivitiesForRange,
  getExerciseMaxes,
  getCoachExerciseHistory,
} from "@/lib/queries";
import { UpcomingGoals } from "@/components/upcoming-goals";
import { getCycleSettings, estimateCyclePhase, PHASE_LABELS } from "@/lib/cycle";
import { computeGlobalScore, scoreLabel, scoreColor } from "@/lib/checkin-types";
import { Nav } from "@/components/nav";
import { Card, LinkButton, sportLabel, Button } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { RevokeButton } from "@/app/coach/revoke-button";
import { todayISO, toISODate } from "@/lib/dates";
import { AthleteCalendar } from "./athlete-calendar";
import { TrainingInsights } from "./training-insights";
import { computeAcwr } from "@/lib/training-stats";
import { computeHrZones } from "@/lib/hr-zones";
import { computePowerZones } from "@/lib/power-zones";
import { computePaceZones, formatPace } from "@/lib/pace-zones";
import { ExerciseMaxesPanel } from "./exercise-maxes-panel";
import { CopyWeekForm } from "./copy-week-form";
import { upsertCoachNotesAction, addMeasurementAction } from "@/lib/actions";
import { PerformanceStats, MeasurementPoint } from "@/app/athlete/profile/performance-stats";

// "Bloc" et "cycle" reprennent le vocabulaire de périodisation de l'entraînement
// (mésocycle ~4 semaines, bloc plus large regroupant plusieurs cycles) plutôt
// que des découpages calendaires stricts — aucune notion de bloc/cycle n'existe
// en base, ce sont ici de simples fenêtres glissantes en jours.
const BILAN_PERIODS: { value: string; label: string; days: number }[] = [
  { value: "jour", label: "Journée", days: 1 },
  { value: "semaine", label: "Semaine", days: 7 },
  { value: "cycle", label: "Cycle", days: 28 },
  { value: "mois", label: "Mois", days: 30 },
  { value: "bloc", label: "Bloc", days: 84 },
];

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
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ view?: string; week?: string; month?: string; bilan?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId } = await params;
  const { view, week, month, bilan } = await searchParams;

  // Garde de permission (cf. prompt : règle la plus critique du produit).
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) {
    notFound();
  }

  const today = todayISO();
  const bilanPeriod = BILAN_PERIODS.find((p) => p.value === bilan) || BILAN_PERIODS.find((p) => p.value === "bloc")!;
  const statsFrom = new Date();
  statsFrom.setDate(statsFrom.getDate() - bilanPeriod.days);
  const statsFromISO = toISODate(statsFrom);
  // Fenêtre fixe à 28 jours pour l'alerte de charge (ACWR), indépendante du
  // filtre de période choisi pour le bilan — sinon le ratio changerait de
  // sens selon l'onglet actif.
  const acwrFrom = new Date();
  acwrFrom.setDate(acwrFrom.getDate() - 27);
  const acwrFromISO = toISODate(acwrFrom);

  // Requêtes indépendantes parties en parallèle plutôt qu'en série — la fiche
  // athlète est la page la plus lourde en aller-retours vers la base distante,
  // les enchaîner une par une multipliait sa latence par leur nombre.
  const [
    athlete,
    athleteAvatar,
    links,
    allWorkouts,
    measurements,
    measurementHistory,
    injuries,
    journalAll,
    cycleSettings,
    athleteGender,
    athleteSports,
    coachNotes,
    recentCheckins,
    upcomingGoals,
    recentImports,
    exerciseMaxes,
    exerciseSuggestions,
    acwrImports,
  ] = await Promise.all([
    findUserById(athleteId),
    getUserAvatar(athleteId),
    getAthletesForCoach(user.id),
    getWorkoutsForAthlete(athleteId),
    getLatestMeasurements(athleteId),
    getMeasurementsForAthlete(athleteId),
    getInjuriesForAthlete(athleteId),
    getJournalForAthlete(athleteId),
    getCycleSettings(athleteId),
    getUserGender(athleteId),
    getAthleteSports(athleteId),
    getCoachNotes(user.id, athleteId),
    getRecentCheckins(athleteId, 1),
    getUpcomingGoals(athleteId),
    getImportedActivitiesForRange(athleteId, statsFromISO, today),
    getExerciseMaxes(athleteId),
    getCoachExerciseHistory(user.id),
    getImportedActivitiesForRange(athleteId, acwrFromISO, today),
  ]);
  if (!athlete) notFound();

  const link = links.find((l) => l.athlete_id === athleteId);
  const journal = journalAll.slice(0, 3);
  const acwr = computeAcwr(allWorkouts, acwrImports, today);
  const hrZones =
    measurements.fc_repos && measurements.fc_max ? computeHrZones(measurements.fc_repos.value, measurements.fc_max.value) : null;
  const powerZones = measurements.ftp ? computePowerZones(measurements.ftp.value) : null;
  const paceZones = measurements.pma_vma ? computePaceZones(measurements.pma_vma.value) : null;
  const METRICS = Object.entries(METRIC_LABELS).map(([value, label]) => ({ value, label }));
  const seriesByMetric: Record<string, MeasurementPoint[]> = {};
  for (const h of measurementHistory as any[]) {
    (seriesByMetric[h.metric] ??= []).push({ value: h.value, recorded_at: h.recorded_at });
  }
  for (const key in seriesByMetric) {
    seriesByMetric[key].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }
  const cycleEstimate =
    athleteGender === "female" && cycleSettings.share_with_coaches ? await estimateCyclePhase(athleteId) : null;
  const latestCheckin = recentCheckins[0];

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar userId={athleteId} firstName={athlete.first_name} hasAvatar={!!athleteAvatar?.avatar_path} size="lg" />
            <div>
              <h1 className="font-display text-3xl text-ink">
                {athlete.first_name} {athlete.last_name}
              </h1>
              <p className="text-slate">{athlete.email}</p>
              {athleteSports.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {athleteSports.map((s: string) => (
                    <span key={s} className="rounded-full bg-paper-dim px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                      {sportLabel(s)}
                    </span>
                  ))}
                </div>
              )}
              {acwr.status !== "insufficient_data" && acwr.status !== "normal" && (
                <span
                  className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    acwr.status === "high_risk" ? "bg-clay/15 text-clay" : "bg-status-postponed/15 text-status-postponed"
                  }`}
                  title={`Charge aiguë (7j) ${acwr.acuteLoad} u.a. vs charge chronique (moy./sem sur 28j) ${acwr.chronicWeeklyLoad} u.a.`}
                >
                  {acwr.status === "high_risk" ? "⚠ Charge en forte hausse" : "Charge en net repli"} — ratio {acwr.ratio}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/coach/athletes/${athleteId}/new-workout`}>+ Nouvelle séance</LinkButton>
            <LinkButton href={`/coach/athletes/${athleteId}/messages`} variant="secondary">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
                </svg>
                Discuter
              </span>
            </LinkButton>
            {link && <RevokeButton linkId={link.link_id} label="Retirer cet athlète" />}
          </div>
        </div>

        <div className="mb-8">
          <CopyWeekForm athleteId={athleteId} />
        </div>

        {/* Notes privées : jamais visibles par l'athlète, ni par un autre coach —
            cf. upsertCoachNotesAction (vérifie coach_id = utilisateur courant). */}
        <Card className="mb-8 rounded-3xl border-2 border-dashed border-gold-light/50 bg-gold-light/5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate">Mes notes privées</h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gold-light">
              Visibles par vous seul·e
            </span>
          </div>
          <p className="mb-3 text-xs text-slate">
            Jamais partagées avec l&apos;athlète, ni avec un autre coach qui le suivrait aussi.
          </p>
          <form
            action={async (formData) => {
              "use server";
              await upsertCoachNotesAction(formData);
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="athleteId" value={athleteId} />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-soft">Points forts</span>
              <textarea
                name="strengths"
                rows={3}
                defaultValue={coachNotes?.strengths || ""}
                placeholder="Ce qui fonctionne bien, à capitaliser…"
                className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-soft">Points faibles / axes de travail</span>
              <textarea
                name="weaknesses"
                rows={3}
                defaultValue={coachNotes?.weaknesses || ""}
                placeholder="Ce sur quoi insister dans la programmation…"
                className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary">
                Enregistrer
              </Button>
              {coachNotes?.updated_at && (
                <span className="ml-3 text-xs text-slate">
                  Dernière mise à jour : {new Date(coachNotes.updated_at.replace(" ", "T")).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          </form>
        </Card>

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card className="rounded-3xl">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Statistiques de performance</h2>
            <p className="mb-3 text-xs text-slate">Cliquez sur un indicateur pour voir son évolution.</p>
            <PerformanceStats metrics={METRICS} latest={measurements} seriesByMetric={seriesByMetric} />
            <form
              action={async (formData) => {
                "use server";
                formData.set("athleteId", athleteId);
                await addMeasurementAction(formData);
              }}
              className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2"
            >
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-soft">Indicateur</span>
                <select name="metric" required className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss">
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-soft">Valeur</span>
                <input type="number" step="0.1" name="value" required className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-soft">Date de la mesure</span>
                <input type="date" name="recordedAt" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-soft">Note (facultatif)</span>
                <input name="note" placeholder="Contexte de la mesure…" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss" />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" variant="secondary">
                  Ajouter une mesure
                </Button>
              </div>
            </form>
          </Card>

          {cycleEstimate && (
            <Card className="rounded-3xl">
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Cycle menstruel</h2>
              <p className="font-medium text-ink">{PHASE_LABELS[cycleEstimate.phase]}</p>
              {cycleEstimate.dayOfCycle && <p className="text-sm text-slate">Jour {cycleEstimate.dayOfCycle} du cycle</p>}
              <p className="mt-2 text-xs text-slate">Partagé volontairement par l&apos;athlète — détail des entrées non visible.</p>
            </Card>
          )}

          {latestCheckin && (
            <Card className="rounded-3xl">
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Forme du jour</h2>
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

          <Card className="rounded-3xl">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Antécédents de blessures</h2>
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

          <Card className="rounded-3xl">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Journal de bord récent</h2>
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

        {(hrZones || powerZones || paceZones) && (
          <>
            <h2 className="mb-3 font-display text-xl text-ink">Zones d&apos;entraînement</h2>
            <p className="mb-3 text-sm text-slate">Calculées à partir des dernières mesures renseignées — un repère par discipline plutôt que la seule fréquence cardiaque.</p>
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              {hrZones && (
                <Card className="rounded-3xl">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Fréquence cardiaque</h3>
                  <ul className="space-y-1.5 text-sm">
                    {hrZones.map((z) => (
                      <li key={z.zone} className="flex items-center justify-between gap-2">
                        <span className="text-ink-soft">
                          Z{z.zone} — {z.label}
                        </span>
                        <span className="font-medium text-ink">
                          {z.minBpm}-{z.maxBpm}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {powerZones && (
                <Card className="rounded-3xl">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Puissance (vélo)</h3>
                  <ul className="space-y-1.5 text-sm">
                    {powerZones.map((z) => (
                      <li key={z.zone} className="flex items-center justify-between gap-2">
                        <span className="text-ink-soft">
                          Z{z.zone} — {z.label}
                        </span>
                        <span className="font-medium text-ink">
                          {z.minW}-{z.maxW} W
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {paceZones && (
                <Card className="rounded-3xl">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Allure (course à pied)</h3>
                  <ul className="space-y-1.5 text-sm">
                    {paceZones.map((z) => (
                      <li key={z.zone} className="flex items-center justify-between gap-2">
                        <span className="text-ink-soft">
                          Z{z.zone} — {z.label}
                        </span>
                        <span className="font-medium text-ink">
                          {formatPace(z.minPaceMinPerKm)} à {formatPace(z.maxPaceMinPerKm)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </>
        )}

        <h2 className="mb-3 font-display text-xl text-ink">Charges de référence</h2>
        <p className="mb-3 text-sm text-slate">
          Renseignez un max testé pour prescrire une charge en % dans le générateur de séance musculation.
        </p>
        <Card className="mb-8 rounded-3xl">
          <ExerciseMaxesPanel athleteId={athleteId} maxes={exerciseMaxes} exerciseSuggestions={exerciseSuggestions} />
        </Card>

        <h2 className="mb-3 font-display text-xl text-ink">Prochains objectifs</h2>
        <div className="mb-8">
          <UpcomingGoals goals={upcomingGoals} />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Bilan d&apos;entraînement</h2>
          <div className="flex rounded-2xl bg-paper-dim p-1">
            {BILAN_PERIODS.map((p) => (
              <Link
                key={p.value}
                href={`/coach/athletes/${athleteId}?bilan=${p.value}`}
                scroll={false}
                className={`rounded-xl px-3.5 py-1.5 text-center text-sm font-semibold transition-colors ${
                  bilanPeriod.value === p.value ? "bg-white text-ink shadow-sm" : "text-slate"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="mb-3 text-sm text-slate">
          Séances faites et activités importées sur la période sélectionnée ({bilanPeriod.days} jour{bilanPeriod.days > 1 ? "s" : ""}).
        </p>
        <div className="mb-8">
          <TrainingInsights
            workouts={allWorkouts.filter((w) => w.date >= statsFromISO && w.date <= today)}
            imports={recentImports}
            periodDays={bilanPeriod.days}
          />
        </div>

        <h2 className="mb-3 font-display text-xl text-ink">Programmation</h2>
        <p className="mb-3 text-sm text-slate">Séances récentes, à venir et activités importées, en un coup d&apos;œil.</p>
        <AthleteCalendar athleteId={athleteId} view={view} week={week} month={month} today={today} />
      </main>
    </div>
  );
}
