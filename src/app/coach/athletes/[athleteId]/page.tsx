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
  getTrainingPeriods,
  getCheckinsForRange,
  getCoachNoteEntries,
} from "@/lib/queries";
import { UpcomingGoals } from "@/components/upcoming-goals";
import { getCycleSettings, estimateCyclePhase, PHASE_LABELS } from "@/lib/cycle";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card, LinkButton, sportLabel, Button } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { RevokeButton } from "@/app/coach/revoke-button";
import {
  todayISO,
  toISODate,
  computeBilanWindow,
  shiftBilanAnchor,
  bilanRangeDays,
  type BilanPeriodValue,
} from "@/lib/dates";
import { AthleteCalendar } from "./athlete-calendar";
import { TrainingInsights } from "./training-insights";
import { PeriodizationPanel } from "./periodization-panel";
import { PeriodBadge } from "@/components/period-badge";
import { FormOfTheDay, FormHistory } from "./form-panel";
import { CoachJournal } from "./coach-journal";
import { computeAcwr } from "@/lib/training-stats";
import { computeHrZones } from "@/lib/hr-zones";
import { computePowerZones } from "@/lib/power-zones";
import { computePaceZones, formatPace } from "@/lib/pace-zones";
import { ExerciseMaxesPanel } from "./exercise-maxes-panel";
import { CopyWeekForm } from "./copy-week-form";
import { AthleteTabs } from "./athlete-tabs";
import { upsertCoachNotesAction, addMeasurementAction } from "@/lib/actions";
import { METRIC_LABELS, MEASUREMENT_DEVICES, computeDerivedMetrics } from "@/lib/performance-metrics";
import { PerformanceStats, MeasurementPoint } from "@/app/athlete/profile/performance-stats";

// "Bloc" et "cycle" reprennent le vocabulaire de périodisation de l'entraînement
// (mésocycle ~4 semaines, bloc plus large regroupant plusieurs cycles) plutôt
// que des découpages calendaires stricts — aucune notion de bloc/cycle n'existe
// en base, ce sont ici de simples fenêtres glissantes en jours.
const BILAN_PERIODS: { value: BilanPeriodValue; label: string }[] = [
  { value: "jour", label: "Journée" },
  { value: "semaine", label: "Semaine" },
  { value: "cycle", label: "Cycle" },
  { value: "mois", label: "Mois" },
  { value: "bloc", label: "Bloc" },
];



export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{
    view?: string;
    week?: string;
    month?: string;
    bilan?: string;
    bilanDate?: string;
    bilanFrom?: string;
    bilanTo?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId } = await params;
  const { view, week, month, bilan, bilanDate, bilanFrom, bilanTo } = await searchParams;

  // Garde de permission (cf. prompt : règle la plus critique du produit).
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) {
    notFound();
  }

  const today = todayISO();
  const bilanPeriod = BILAN_PERIODS.find((p) => p.value === bilan) || BILAN_PERIODS.find((p) => p.value === "bloc")!;
  // Ancre de la fenêtre : la date choisie dans le sélecteur, sinon aujourd'hui.
  // Le format est validé ici pour qu'une URL trafiquée ne produise pas de dates
  // « Invalid Date » dans tous les calculs en aval.
  const bilanAnchor = bilanDate && /^\d{4}-\d{2}-\d{2}$/.test(bilanDate) ? bilanDate : today;
  // Plage libre : deux dates quelconques priment sur la période calée, pour
  // répondre aux questions qui ne tombent pas sur une semaine ou un mois
  // entier (« du début du stage au jour de la course »).
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const customRange =
    bilanFrom && bilanTo && isoRe.test(bilanFrom) && isoRe.test(bilanTo) && bilanFrom <= bilanTo
      ? { from: bilanFrom, to: bilanTo }
      : null;
  const bilanWindow = customRange
    ? {
        from: customRange.from,
        to: customRange.to,
        days: bilanRangeDays(customRange.from, customRange.to),
        label: `Du ${customRange.from.slice(8, 10)}/${customRange.from.slice(5, 7)} au ${customRange.to.slice(8, 10)}/${customRange.to.slice(5, 7)}`,
      }
    : computeBilanWindow(bilanPeriod.value, bilanAnchor);
  const statsFromISO = bilanWindow.from;
  const statsToISO = bilanWindow.to;
  const bilanPrev = shiftBilanAnchor(bilanPeriod.value, bilanAnchor, -1);
  const bilanNext = shiftBilanAnchor(bilanPeriod.value, bilanAnchor, 1);
  const bilanHref = (period: BilanPeriodValue, anchor: string) =>
    `/coach/athletes/${athleteId}?bilan=${period}&bilanDate=${anchor}`;
  // Pas de navigation vers le futur : une fenêtre qui commence après aujourd'hui
  // ne contiendrait que des séances prévues, jamais de bilan.
  const canGoNext = !customRange && computeBilanWindow(bilanPeriod.value, bilanNext).from <= today;
  const isCurrentWindow = today >= bilanWindow.from && today <= bilanWindow.to;
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
    trainingPeriods,
    bilanCheckins,
    coachNoteEntries,
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
    getImportedActivitiesForRange(athleteId, statsFromISO, statsToISO),
    getExerciseMaxes(athleteId),
    getCoachExerciseHistory(user.id),
    getImportedActivitiesForRange(athleteId, acwrFromISO, today),
    getTrainingPeriods(athleteId),
    getCheckinsForRange(athleteId, statsFromISO, statsToISO),
    getCoachNoteEntries(user.id, athleteId),
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
  // Indicateurs dérivés à partir des mesures d'une même date (cf. profil athlète).
  const measuresByDate = new Map<string, Record<string, number>>();
  for (const h of measurementHistory as any[]) {
    const day = h.recorded_at.slice(0, 10);
    if (!measuresByDate.has(day)) measuresByDate.set(day, {});
    const bucket = measuresByDate.get(day)!;
    if (!(h.metric in bucket)) bucket[h.metric] = h.value;
  }
  const latestMeasureDay = [...measuresByDate.keys()].sort().reverse()[0];
  const derivedMetrics = latestMeasureDay ? computeDerivedMetrics(measuresByDate.get(latestMeasureDay)!) : [];
  const cycleEstimate =
    athleteGender === "female" && cycleSettings.share_with_coaches ? await estimateCyclePhase(athleteId) : null;
  const latestCheckin = recentCheckins[0];

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
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

        <AthleteTabs
          storageKey={`rythme:athlete-tab:${athleteId}`}
          children={{
            apercu: (
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-6">
        <div className="mb-8">
          <CopyWeekForm athleteId={athleteId} />
        </div>


            </div>
            <div className="flex flex-col gap-6">


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
              <FormOfTheDay checkin={latestCheckin} />
            </Card>
          )}


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
          </div>
            ),
            programmation: (
              <>
        <h2 className="mb-3 font-display text-xl text-ink">Programmation</h2>
        <p className="mb-3 text-sm text-slate">Séances récentes, à venir et activités importées, en un coup d&apos;œil.</p>
        {/* Rappel de la période en cours : on programme dans un cycle, pas dans le vide. */}
        <div className="mb-3">
          <PeriodBadge periods={trainingPeriods} date={today} prefix="Aujourd'hui :" />
        </div>
        <AthleteCalendar athleteId={athleteId} view={view} week={week} month={month} today={today} />

        {/* Les objectifs vivent ici et nulle part ailleurs : c'est en programmant
            qu'on a besoin de voir vers quoi on programme. */}
        <div className="mt-8">
          <UpcomingGoals goals={upcomingGoals} />
        </div>

              </>
            ),
            periodisation: <PeriodizationPanel athleteId={athleteId} periods={trainingPeriods} today={today} />,
            bilan: (
              <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Bilan d&apos;entraînement</h2>
          <div className="flex rounded-2xl bg-paper-dim p-1">
            {BILAN_PERIODS.map((p) => (
              <Link
                key={p.value}
                href={bilanHref(p.value, bilanAnchor)}
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
        {/* Navigation de période : le bilan ne se limitait qu'à une fenêtre
            glissante finissant aujourd'hui, impossible donc de revoir une
            semaine précise. On peut maintenant reculer, avancer, ou choisir
            directement une date dans la période voulue. */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2">
          <Link
            href={bilanHref(bilanPeriod.value, bilanPrev)}
            scroll={false}
            aria-label="Période précédente"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg leading-none text-slate transition-colors hover:bg-paper-dim hover:text-ink"
          >
            ‹
          </Link>
          <span className="min-w-0 flex-1 text-center text-sm font-semibold capitalize text-ink">{bilanWindow.label}</span>
          {canGoNext ? (
            <Link
              href={bilanHref(bilanPeriod.value, bilanNext)}
              scroll={false}
              aria-label="Période suivante"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg leading-none text-slate transition-colors hover:bg-paper-dim hover:text-ink"
            >
              ›
            </Link>
          ) : (
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg leading-none text-line"
            >
              ›
            </span>
          )}
          <form action={`/coach/athletes/${athleteId}`} className="flex items-center gap-2">
            <input type="hidden" name="bilan" value={bilanPeriod.value} />
            <input
              type="date"
              name="bilanDate"
              defaultValue={bilanAnchor}
              max={today}
              aria-label="Aller à une date"
              className="rounded-xl border border-line bg-paper-dim px-2 py-1 text-xs text-ink"
            />
            <button type="submit" className="rounded-xl bg-moss px-3 py-1.5 text-xs font-semibold text-white">
              Aller
            </button>
          </form>
          {(!isCurrentWindow || customRange) && (
            <Link
              href={bilanHref(bilanPeriod.value, today)}
              scroll={false}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-slate transition-colors hover:text-ink"
            >
              Aujourd&apos;hui
            </Link>
          )}
        </div>

        {/* Plage libre, pour les questions qui ne tombent pas sur une semaine
            ou un mois entier. */}
        <form
          action={`/coach/athletes/${athleteId}`}
          className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white px-3 py-2"
        >
          <input type="hidden" name="bilan" value={bilanPeriod.value} />
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate">Du</label>
            <input
              type="date"
              name="bilanFrom"
              defaultValue={customRange?.from ?? statsFromISO}
              max={today}
              className="rounded-xl border border-line bg-paper-dim px-2 py-1 text-xs text-ink"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate">Au</label>
            <input
              type="date"
              name="bilanTo"
              defaultValue={customRange?.to ?? statsToISO}
              max={today}
              className="rounded-xl border border-line bg-paper-dim px-2 py-1 text-xs text-ink"
            />
          </div>
          <button type="submit" className="rounded-xl bg-moss px-3 py-1.5 text-xs font-semibold text-white">
            Afficher cette plage
          </button>
          {customRange && <span className="text-xs text-slate">Plage personnalisée active</span>}
        </form>
        <p className="mb-3 text-sm text-slate">
          Séances faites et activités importées du {statsFromISO.slice(8, 10)}/{statsFromISO.slice(5, 7)} au{" "}
          {statsToISO.slice(8, 10)}/{statsToISO.slice(5, 7)} ({bilanWindow.days} jour{bilanWindow.days > 1 ? "s" : ""}).
        </p>
        <div className="mb-8">
          <TrainingInsights
            workouts={allWorkouts.filter((w) => w.date >= statsFromISO && w.date <= statsToISO)}
            imports={recentImports}
            periodDays={bilanWindow.days}
            periodEnd={statsToISO < today ? statsToISO : today}
          />
        </div>

        {/* La forme subjective se lit à côté de la charge, pas ailleurs : c'est
            leur mise en regard qui dit si la charge passe bien. */}
        <Card className="mb-8 rounded-3xl">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Évolution de la forme</h3>
          <FormHistory checkins={bilanCheckins} />
        </Card>


              </>
            ),
            mesures: (
              <div className="flex flex-col gap-6">

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
                <input type="date" name="recordedAt" defaultValue={todayISO()} className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-soft">Appareil utilisé</span>
                <select name="device" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss">
                  {MEASUREMENT_DEVICES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-ink-soft">Note (facultatif)</span>
                <input name="note" placeholder="Contexte de la mesure…" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss" />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" variant="secondary">
                  Ajouter une mesure
                </Button>
              </div>
            </form>
            {derivedMetrics.length > 0 && (
              <div className="mt-4 rounded-2xl bg-paper-dim p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">
                  Calculé automatiquement <span className="font-normal normal-case">— mesures du {latestMeasureDay}</span>
                </p>
                <ul className="flex flex-col gap-2">
                  {derivedMetrics.map((d) => (
                    <li key={d.label} className="text-sm">
                      <span className="text-ink-soft">{d.label} : </span>
                      <span className="font-semibold text-ink">{d.value}</span>
                      <p className="text-xs text-slate">{d.explanation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
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

              </div>
            ),
            sante: (
              <div className="flex flex-col gap-6">

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
              <FormOfTheDay checkin={latestCheckin} />
            </Card>
          )}

              </div>
            ),
            notes: (
              <>
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

        {/* Journal : des notes courtes ajoutées au fil des jours, chacune datée,
            qui forment l'historique du suivi. Le portrait ci-dessus se réécrit,
            celui-ci s'accumule. */}
        <Card className="mb-8 rounded-3xl">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate">Journal de suivi</h2>
            <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[10px] font-semibold text-slate">
              Visibles par vous seul·e
            </span>
          </div>
          <CoachJournal athleteId={athleteId} entries={coachNoteEntries} today={today} />
        </Card>

              </>
            ),
          }}
        />
      </main>
      </div>
    </div>
  );
}
