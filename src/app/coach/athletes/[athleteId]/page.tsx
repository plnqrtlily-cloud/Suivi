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
  getUserGender,
  getAthleteSports,
  getUserAvatar,
  getUpcomingGoals,
  getImportedActivitiesForRange,
  getExerciseMaxes,
  getCoachExerciseHistory,
  getTrainingPeriods,
  getCheckinsForRange,
  getCoachNoteEntries,
  getPersonalRecordsForAthlete,
  getUnreadMessageCount,
  getLastUnreadMessage,
  getTeamsForAthlete,
  getCustomEffortTestsForCoach,
  getZoneOverrides,
  getInjuryFollowupsForAthlete,
  getPerformanceProfile,
  getCoachProfileQualities,
  getEffortTestBatchesForAthlete,
} from "@/lib/queries";
import { positionLabel, type TeamSport } from "@/lib/team-sports";
import { getCycleSettings, getPeriodStarts } from "@/lib/cycle";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { sportLabel } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { RevokeButton } from "@/app/coach/revoke-button";
import { todayISO } from "@/lib/dates";
import { computeAcwr } from "@/lib/training-stats";
import { formatPace } from "@/lib/pace-zones";
import { periodsOnDate, weekPosition } from "@/lib/periodization";
import { PERFORMANCE_METRICS } from "@/lib/performance-metrics";
import { EFFORT_TEST_CATALOG } from "@/lib/effort-tests";
import {
  addDays,
  mondayOf,
  isoWeekNumber,
  shortDate,
  buildLoadWeeks,
  overviewStats,
  buildAttention,
  seasonSpan,
  cycleSummary,
  cycleRing,
} from "@/lib/athlete-overview";
import { loadCoachCalendar } from "@/lib/coach-calendar";
import { AthleteTabs } from "./athlete-tabs";
import { CoachCalendar } from "./coach-calendar";
import { OverviewTab } from "./overview-tab";
import { PeriodizationPanel } from "./periodization-panel";
import { MeasuresTab, type MetricSeries } from "./measures-tab";
import { ZonesPanel, type ZoneActivity } from "./zones-panel";
import { autoZones, frDay, parseCuts } from "@/lib/training-zones";
import { ChargesList } from "./charges-list";
import { PerformanceProfile } from "./performance-profile";
import { parseImpact } from "@/lib/injury-catalog";
import { BodyMeasures } from "./body-measures";
import { HealthTab, type InjuryView } from "./health-tab";
import { NotesTab } from "./notes-tab";
import { ExerciseMaxesPanel } from "./exercise-maxes-panel";
import { MeasurementsHistory } from "./measurements-history";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Indicateurs de test mis en avant (aperçu, évolution), avec un libellé court.
const KEY_METRICS: { key: string; short: string }[] = [
  { key: "vo2max", short: "VO2max" },
  { key: "pma_vma", short: "PMA / VMA" },
  { key: "ftp", short: "FTP" },
  { key: "fc_max", short: "FC max" },
  { key: "fc_seuil", short: "FC seuil" },
  { key: "seuil_lactique_w", short: "Seuil lactique" },
  { key: "allure_natation_min_100m", short: "CSS" },
];

function metricDef(key: string) {
  return PERFORMANCE_METRICS.find((m) => m.value === key);
}
function fmtMetric(value: number, unit?: string) {
  const v = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
  return unit ? `${v} ${unit}` : v;
}

export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ view?: string; week?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId } = await params;
  const { view, week, month } = await searchParams;

  // Garde de permission (cf. prompt : règle la plus critique du produit).
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) {
    notFound();
  }

  const today = todayISO();
  // Les périodes fixent l'étendue de la frise, donc la plage de données à
  // charger : elles passent avant le reste.
  const trainingPeriodsEarly = await getTrainingPeriods(athleteId);
  const span = seasonSpan(trainingPeriodsEarly, today);
  const currentMonday = mondayOf(today);
  // Une seule plage couvre l'aperçu (6 mois + semaine suivante) et la frise
  // de la saison : les séances et check-ins ne sont chargés qu'une fois.
  const overviewFrom = addDays(currentMonday, -25 * 7);
  const rangeFrom = [overviewFrom, mondayOf(span.from)].sort()[0];
  const rangeTo = [addDays(currentMonday, 7), mondayOf(span.to)].sort()[1];

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
    upcomingGoals,
    rangeImports,
    exerciseMaxes,
    exerciseSuggestions,
    rangeCheckins,
    coachNoteEntries,
    personalRecords,
    unreadCount,
    lastUnread,
    athleteTeams,
    customEffortTests,
    effortTestBatches,
    periodStarts,
    zoneOverrides,
    injuryFollowups,
    perfProfile,
    coachQualities,
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
    getUpcomingGoals(athleteId),
    getImportedActivitiesForRange(athleteId, rangeFrom, addDays(rangeTo, 6)),
    getExerciseMaxes(athleteId),
    getCoachExerciseHistory(user.id),
    getCheckinsForRange(athleteId, addDays(rangeFrom, -90), today),
    getCoachNoteEntries(user.id, athleteId),
    getPersonalRecordsForAthlete(athleteId),
    getUnreadMessageCount(user.id, athleteId, user.id),
    getLastUnreadMessage(user.id, athleteId, user.id),
    getTeamsForAthlete(athleteId, user.id),
    getCustomEffortTestsForCoach(user.id),
    getEffortTestBatchesForAthlete(athleteId),
    getPeriodStarts(athleteId),
    getZoneOverrides(athleteId),
    getInjuryFollowupsForAthlete(athleteId),
    getPerformanceProfile(athleteId),
    getCoachProfileQualities(user.id),
  ]);
  if (!athlete) notFound();
  const trainingPeriods = trainingPeriodsEarly;
  const firstName = athlete.first_name;

  const link = links.find((l) => l.athlete_id === athleteId);
  const cycleShared = athleteGender === "female" && !!cycleSettings.share_with_coaches;
  const calendarData = await loadCoachCalendar({
    athleteId,
    athleteName: firstName,
    coachId: user.id,
    view,
    week,
    month,
    today,
    cycleShared,
  });

  // ---------- Aperçu ----------
  const acwrImports = rangeImports.filter((a) => a.activity_date >= addDays(today, -27));
  const acwr = computeAcwr(allWorkouts, acwrImports, today);
  const allWeeks = buildLoadWeeks({
    workouts: allWorkouts,
    imports: rangeImports,
    checkins: rangeCheckins,
    periods: trainingPeriods,
    fromMonday: rangeFrom,
    toMonday: rangeTo,
    today,
  });
  const overviewWeeks = allWeeks.filter((w) => w.weekStart >= overviewFrom && w.weekStart <= addDays(currentMonday, 7));
  const activeInjury = injuries.find((i) => !i.date_end) ?? null;
  const attention = buildAttention({
    athleteId,
    firstName,
    today,
    workouts: allWorkouts,
    checkins: rangeCheckins,
    weeks: overviewWeeks,
    acwr,
    activeInjury,
    unread: { count: unreadCount, last: lastUnread },
    hasUpcoming: allWorkouts.some((w) => w.date > today && !w.is_draft && w.status === "planned"),
  });
  const todayDate = new Date(`${today}T00:00:00`);
  const overviewTitle = `${DAYS[todayDate.getDay()]} ${todayDate.getDate()} ${MONTHS[todayDate.getMonth()]}`;
  const activeNow = periodsOnDate(trainingPeriods, today);
  const finestNow = activeNow[activeNow.length - 1];
  const posNow = finestNow ? weekPosition(finestNow, today) : null;
  const overviewSubtitle =
    `Semaine ${isoWeekNumber(today)}` +
    (finestNow ? ` · ${finestNow.name}${posNow ? `, semaine ${posNow.week} sur ${posNow.totalWeeks}${posNow.isDeload ? " (décharge)" : ""}` : ""}` : "");

  const latestMeasureDates = KEY_METRICS.map((k) => measurements[k.key]?.recorded_at).filter(Boolean) as string[];
  const overviewTests = {
    date: latestMeasureDates.length ? shortDate(latestMeasureDates.sort().reverse()[0].slice(0, 10)) : null,
    items: KEY_METRICS.filter((k) => measurements[k.key])
      .slice(0, 5)
      .map((k) => ({ label: k.short, value: fmtMetric(measurements[k.key].value, metricDef(k.key)?.unit) })),
  };

  // ---------- Périodisation ----------
  const spanWeeks = allWeeks.filter((w) => w.weekStart >= mondayOf(span.from) && w.weekStart <= mondayOf(span.to));
  const nextGoal = upcomingGoals[0] as { title: string; date: string } | undefined;
  const goalForPeriod =
    nextGoal && calendarData.goal ? { title: nextGoal.title, date: nextGoal.date, dateLabel: calendarData.goal.dateLabel, days: calendarData.goal.days } : null;

  // ---------- Mesures ----------
  const history = measurementHistory as { metric: string; value: number; recorded_at: string }[];
  const seriesOf = (key: string) =>
    history
      .filter((h) => h.metric === key)
      .map((h) => ({ date: h.recorded_at.slice(0, 10), value: h.value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  const series: MetricSeries[] = KEY_METRICS.map((k) => ({
    key: k.key,
    label: k.short,
    unit: metricDef(k.key)?.unit ?? "",
    points: seriesOf(k.key),
  })).filter((s) => s.points.length >= 2);

  const latestBatch = effortTestBatches[0];
  const weight = measurements.weight_kg?.value;
  const latestTest = latestBatch
    ? {
        label:
          (latestBatch.testSlug ? EFFORT_TEST_CATALOG[latestBatch.testSlug]?.label : latestBatch.customLabel) ??
          latestBatch.customLabel ??
          "Test",
        date: shortDate(latestBatch.testDate.slice(0, 10)),
        items: latestBatch.metrics.slice(0, 5).map((m) => {
          const def = metricDef(m.metric);
          return {
            label: KEY_METRICS.find((k) => k.key === m.metric)?.short ?? def?.label ?? m.metric,
            value: fmtMetric(m.value, def?.unit),
            hint: def?.unit === "W" && weight ? `${(m.value / weight).toFixed(1).replace(".", ",")} W/kg` : undefined,
          };
        }),
      }
    : overviewTests.items.length
      ? { label: "Dernières valeurs", date: overviewTests.date ?? "", items: overviewTests.items }
      : null;

  // Puissances de référence pour le rapport poids / puissance (dernière valeur).
  const lastOf = (metric: string, ok: (v: number) => boolean = () => true) => {
    const h = history.filter((x) => x.metric === metric && ok(x.value)).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
    return h ? { value: h.value, date: h.recorded_at.slice(0, 10) } : undefined;
  };
  // PMA/VMA partagent la même mesure : au-delà de 60, c'est une puissance en watts.
  const powerRefs = { pma: lastOf("pma_vma", (v) => v > 60), ftp: lastOf("ftp") };

  // Zones : seuils du dernier test de labo s'il y en a, sinon FC / FTP / PMA / VMA.
  const svBatch = effortTestBatches.find((b) => b.data.sv1_bpm || b.data.sv2_bpm || b.data.sv2_w);
  const zoneRefs = {
    pma: powerRefs.pma?.value,
    vma: lastOf("pma_vma", (v) => v <= 60)?.value,
    fcMax: measurements.fc_max?.value,
  };
  const autoZ = autoZones({
    fcRepos: measurements.fc_repos?.value,
    fcMax: zoneRefs.fcMax,
    ftp: measurements.ftp?.value,
    pma: zoneRefs.pma,
    vma: zoneRefs.vma,
    sv: svBatch
      ? { sv1w: svBatch.data.sv1_w, sv2w: svBatch.data.sv2_w, sv1hr: svBatch.data.sv1_bpm, sv2hr: svBatch.data.sv2_bpm, date: svBatch.testDate, label: "" }
      : undefined,
  });
  // Temps passé : activités importées + séances réalisées (hors celles déjà liées à un import), sur 28 jours.
  const zoneFrom = addDays(today, -27);
  const importedWorkoutIds = new Set(rangeImports.map((a) => a.workout_id).filter(Boolean));
  const zoneActivities: ZoneActivity[] = [
    ...rangeImports
      .filter((a) => a.activity_date >= zoneFrom && a.activity_date <= today)
      .map((a) => ({ minutes: a.duration_minutes ?? 0, hr: a.avg_hr, power: a.avg_power_w, km: a.distance_km, sport: a.sport })),
    ...allWorkouts
      .filter((w) => w.date >= zoneFrom && w.date <= today && w.status === "done" && !importedWorkoutIds.has(w.id))
      .map((w) => ({ minutes: w.actual_duration_minutes ?? w.duration_minutes ?? 0, hr: w.avg_hr, power: w.avg_power_w, km: w.distance_km, sport: w.sport })),
  ]
    .filter((a) => a.minutes > 0)
    .map((a) => ({
      minutes: a.minutes,
      hr: a.hr ?? undefined,
      power: a.power ?? undefined,
      kmh: a.sport === "running" && a.km ? a.km / (a.minutes / 60) : undefined,
    }));

  const recordsOf = (prs: typeof personalRecords) => {
    const records: { label: string; value: string; hint: string }[] = [];
    for (const r of prs) {
      const sp = sportLabel(r.sport).toLowerCase();
      if (r.bestDistanceKm !== null)
        records.push({ label: `Plus longue sortie · ${sp}`, value: `${fmtMetric(r.bestDistanceKm)} km`, hint: r.bestDistanceDate ? shortDate(r.bestDistanceDate.slice(0, 10)) : "" });
      if (r.bestPaceMinPerKm !== null && r.sport === "running")
        records.push({ label: "Meilleure allure", value: formatPace(r.bestPaceMinPerKm), hint: r.bestPaceDate ? shortDate(r.bestPaceDate.slice(0, 10)) : "" });
      if (r.bestDurationMinutes !== null)
        records.push({
          label: `Plus longue durée · ${sp}`,
          value:
            r.bestDurationMinutes < 60
              ? `${Math.round(r.bestDurationMinutes)} min`
              : `${Math.floor(r.bestDurationMinutes / 60)} h ${String(Math.round(r.bestDurationMinutes % 60)).padStart(2, "0")}`,
          hint: r.bestDurationDate ? shortDate(r.bestDurationDate.slice(0, 10)) : "",
        });
    }
    return records;
  };
  // Saison : celle de la périodisation, sinon depuis le 1er septembre.
  const seasonFrom = span.season?.start_date ?? `${Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 9 ? 1 : 0)}-09-01`;
  const seasonRecords = await getPersonalRecordsForAthlete(athleteId, seasonFrom);
  const records = { season: recordsOf(seasonRecords), all: recordsOf(personalRecords), seasonFrom: frDay(seasonFrom) };

  const METRICS = PERFORMANCE_METRICS.map((m) => ({
    value: m.value,
    label: m.unit ? `${m.label} (${m.unit})` : m.label,
    group: m.group,
  }));

  // ---------- Santé ----------
  const injuryViews: InjuryView[] = injuries.map((i) => ({
    id: i.id,
    label: i.zone,
    bodyPart: i.body_part ?? null,
    side: i.side ?? null,
    type: i.injury_type ?? null,
    pain: i.pain ?? null,
    dateStart: i.date_start,
    dateEnd: i.date_end,
    returnDate: i.return_date ?? null,
    description: i.description,
    advice: i.advice ?? null,
    impact: parseImpact(i.impact_json),
    followups: injuryFollowups.filter((f) => f.injury_id === i.id).map((f) => ({ id: f.id, date: f.follow_date, pain: f.pain, note: f.note })),
  }));
  const healthSports = athleteSports.length ? athleteSports.map((sp: string) => ({ key: sp, label: sportLabel(sp) })) : [{ key: "general", label: "Entraînement" }];
  const ring = cycleShared ? cycleRing({ periodStarts, settings: cycleSettings, checkins: rangeCheckins, today, firstName }) : null;
  const cycle = cycleShared
    ? cycleSummary({ periodStarts, settings: cycleSettings, checkins: rangeCheckins, today, firstName })
    : null;

  const sportsLine = athleteSports.map((s: string) => sportLabel(s)).join(" · ");

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar userId={athleteId} firstName={firstName} hasAvatar={!!athleteAvatar?.avatar_path} size="md" />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  {athlete.first_name} {athlete.last_name}
                </h1>
                <p className="text-sm text-ink-soft">
                  {sportsLine || athlete.email}
                  {athleteTeams.map((t) => (
                    <span key={t.team_id}>
                      {" · "}
                      <Link href={`/coach/equipes/${t.team_id}`} className="hover:underline">
                        {t.team_name}, {positionLabel(t.sport as TeamSport, t.position)}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>
            </div>
            <Link
              href={`/coach/athletes/${athleteId}/messages`}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-semibold text-moss-dark transition-colors hover:bg-paper-dim"
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
              </svg>
              Discuter
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-light px-1.5 text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>

          <AthleteTabs
            panels={{
              apercu: (
                <OverviewTab
                  firstName={firstName}
                  title={overviewTitle}
                  subtitle={overviewSubtitle}
                  goal={calendarData.goal}
                  attention={attention}
                  weeks={overviewWeeks}
                  stats={overviewStats(overviewWeeks, acwr)}
                  journal={journalAll.map((j) => ({ id: j.id, date: shortDate(j.entry_date.slice(0, 10)), content: j.content }))}
                  tests={overviewTests}
                />
              ),
              programmation: <CoachCalendar data={calendarData} />,
              periodisation: (
                <PeriodizationPanel
                  athleteId={athleteId}
                  periods={trainingPeriods}
                  today={today}
                  span={{ from: span.from, to: span.to, seasonId: span.season?.id ?? null }}
                  weeks={spanWeeks}
                  goal={goalForPeriod}
                />
              ),
              mesures: (
                <MeasuresTab
                  athleteId={athleteId}
                  latestTest={latestTest}
                  series={series}
                  bodyPanel={<BodyMeasures athleteId={athleteId} history={measurementHistory} power={powerRefs} />}
                  zonesPanel={
                    <ZonesPanel
                      athleteId={athleteId}
                      auto={autoZ}
                      overrides={{ hr: parseCuts(zoneOverrides?.hr_json), pw: parseCuts(zoneOverrides?.pw_json), pace: parseCuts(zoneOverrides?.pace_json) }}
                      overriddenAt={zoneOverrides?.updated_at ?? null}
                      source={autoZ.source}
                      refs={zoneRefs}
                      activities={zoneActivities}
                    />
                  }
                  maxesList={<ChargesList athleteId={athleteId} maxes={exerciseMaxes} />}
                  records={records}
                  batches={effortTestBatches}
                  customTests={customEffortTests}
                  weight={weight}
                  maxesPanel={<ExerciseMaxesPanel athleteId={athleteId} maxes={exerciseMaxes} exerciseSuggestions={exerciseSuggestions} formOnly />}
                  historyPanel={
                    measurementHistory.length > 0 ? (
                      <MeasurementsHistory athleteId={athleteId} history={measurementHistory} metrics={METRICS} />
                    ) : (
                      <p className="text-sm text-slate">Aucune mesure.</p>
                    )
                  }
                />
              ),
              sante: (
                <HealthTab
                  athleteId={athleteId}
                  firstName={firstName}
                  injuries={injuryViews}
                  sports={healthSports}
                  ring={ring}
                  cycle={cycle}
                  cycleShared={cycleShared}
                  today={today}
                />
              ),
              notes: (
                <NotesTab
                  athleteId={athleteId}
                  entries={coachNoteEntries}
                  profile={
                    <PerformanceProfile
                      athleteId={athleteId}
                      firstName={firstName}
                      qualities={perfProfile.qualities}
                      evalDate={perfProfile.evalDate}
                      prevEvalDate={perfProfile.prevEvalDate}
                      selfRequestedAt={perfProfile.selfRequestedAt}
                      selfEvalDate={perfProfile.selfEvalDate}
                      coachQualities={coachQualities}
                    />
                  }
                  footer={
                    link && (
                      <div className="flex items-center justify-end gap-3 pt-2 text-[13px] text-slate">
                        Ne plus suivre {firstName} ?
                        <RevokeButton linkId={link.link_id} label="Retirer cet athlète" />
                      </div>
                    )
                  }
                />
              ),
            }}
          />
        </main>
      </div>
    </div>
  );
}
