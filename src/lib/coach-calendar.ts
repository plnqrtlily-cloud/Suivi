// Chargement du calendrier coach (vue semaine ou mois) : toutes les requêtes
// de la période en une fois, puis mise en forme dans CoachCalendarData.

import {
  getWorkoutsForAthlete,
  getImportedActivitiesForRange,
  getAvailabilityBlocksForRange,
  getCheckinsForRange,
  getCommentsForWorkouts,
  getBlocksForWorkouts,
  getTrainingPeriods,
  getNextGoalForAthlete,
  getUserGender,
  type Workout,
  type ImportedActivity,
} from "./queries";
import { getCycleSettings, getPeriodStarts } from "./cycle";
import { cycleDayForDate } from "./cycle-types";
import { computeGlobalScore, scoreLabel } from "./checkin-types";
import { daysUntil } from "./dates";
import { formatWorkoutTime, AVAILABILITY_SLOT_LABELS } from "./time-of-day";
import { periodsOnDate, weekPosition } from "./periodization";
import { intervalsToLines, strengthBlocksToLines } from "./workout-content";
import { sessionLoad } from "./training-stats";
import { activityForSport, parsePlan, planSummary } from "./discipline";
import type {
  CoachCalendarData,
  CalDay,
  CalEntry,
  CalWeek,
  CalComment,
  EntryStatus,
} from "./coach-calendar-types";

const SPORT_LABELS: Record<string, string> = {
  running: "Course à pied",
  cycling: "Vélo",
  hiking: "Randonnée",
  swimming: "Natation",
  climbing: "Escalade",
  strength: "Musculation",
  other: "Divers",
};
const SPORT_COLORS: Record<string, string> = {
  running: "#e8896a",
  cycling: "#1b4b4f",
  hiking: "#7c5c46",
  swimming: "#6f9fb8",
  climbing: "#6b7a8a",
  strength: "#b9a18f",
  other: "#9aa39c",
};
const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoWeek(iso: string): number {
  const d = parse(iso);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

function frDay(iso: string): string {
  const d = parse(iso);
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function commentWhen(createdAt: string): string {
  const d = new Date(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "Europe/Paris" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", "h");
  return `${day} ${time}`;
}

function workoutStatus(w: Workout, today: string): EntryStatus {
  switch (w.status) {
    case "done":
    case "partial":
      return w.coach_validated_at ? "done" : "tovalidate";
    case "not_done":
      return "miss";
    case "postponed":
      return "postponed";
    default:
      return w.date < today ? "noreport" : "todo";
  }
}

function addDaysISO(iso: string, n: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayISO(iso: string): string {
  const d = parse(iso);
  return addDaysISO(iso, -((d.getDay() + 6) % 7));
}

/** Semaines chargées d'un coup autour de la date affichée, puis par blocs au défilement. */
export const CALENDAR_INITIAL_BEFORE = 8;
export const CALENDAR_INITIAL_AFTER = 12;
export const CALENDAR_CHUNK = 8;

export async function isCycleSharedWithCoach(athleteId: string): Promise<boolean> {
  const [gender, settings] = await Promise.all([getUserGender(athleteId), getCycleSettings(athleteId)]);
  return gender === "female" && !!settings?.share_with_coaches;
}

/**
 * Calendrier coach : la page charge quelques mois autour de la semaine ou du
 * mois demandé ; le composant client en charge d'autres au fil du défilement
 * (loadCoachCalendarWeeksAction), sans changer de page.
 */
export async function loadCoachCalendar(params: {
  athleteId: string;
  athleteName: string;
  coachId: string;
  view?: string;
  week?: string;
  month?: string;
  today: string;
  cycleShared: boolean;
}): Promise<CoachCalendarData> {
  const { athleteId, coachId, today } = params;
  const view: "week" | "month" = params.view === "month" ? "month" : "week";
  const offset = params.week && /^-?\d+$/.test(params.week) ? Math.max(-520, Math.min(520, Number(params.week))) : 0;
  const [ty, tm] = today.split("-").map(Number);
  const monthStr = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : `${ty}-${String(tm).padStart(2, "0")}`;
  const focus = view === "week" ? addDaysISO(mondayISO(today), offset * 7) : `${monthStr}-01`;
  const from = addDaysISO(mondayISO(focus), -CALENDAR_INITIAL_BEFORE * 7);
  const [weeks, goal] = await Promise.all([
    loadCalendarWeeks({ athleteId, coachId, from, count: CALENDAR_INITIAL_BEFORE + CALENDAR_INITIAL_AFTER, today, cycleShared: params.cycleShared }),
    getNextGoalForAthlete(athleteId, today),
  ]);
  return {
    athleteId,
    athleteName: params.athleteName,
    view,
    focus,
    today,
    goal: goal ? { title: goal.title, dateLabel: frDay(goal.date), days: daysUntil(goal.date) } : null,
    weeks,
    cycleShared: params.cycleShared,
  };
}

/** `count` semaines complètes (lundi → dimanche) à partir du lundi `from`. */
export async function loadCalendarWeeks(params: {
  athleteId: string;
  coachId: string;
  from: string;
  count: number;
  today: string;
  cycleShared: boolean;
}): Promise<CalWeek[]> {
  const { athleteId, coachId, today } = params;
  const from = mondayISO(params.from);
  const weeksDates: { date: string; inMonth: boolean }[][] = Array.from({ length: params.count }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => ({ date: addDaysISO(from, w * 7 + d), inMonth: true }))
  );
  const to = weeksDates[weeksDates.length - 1][6].date;

  const [workouts, imports, blocks, checkins, periods] = await Promise.all([
    getWorkoutsForAthlete(athleteId, from, to, true),
    getImportedActivitiesForRange(athleteId, from, to),
    getAvailabilityBlocksForRange(athleteId, from, to),
    getCheckinsForRange(athleteId, from, to),
    getTrainingPeriods(athleteId),
  ]);
  const ids = workouts.map((w) => w.id);
  const strengthIds = workouts.filter((w) => w.sport === "strength").map((w) => w.id);
  const [comments, strengthBlocks, cycleSettings, periodStarts] = await Promise.all([
    getCommentsForWorkouts(ids),
    getBlocksForWorkouts(strengthIds),
    params.cycleShared ? getCycleSettings(athleteId) : Promise.resolve(null),
    params.cycleShared ? getPeriodStarts(athleteId) : Promise.resolve([] as string[]),
  ]);

  type CommentRow = { id: string; workout_id: string; author_id: string; first_name: string; body: string; created_at: string };
  const toComment = (c: CommentRow): CalComment => ({
    id: c.id,
    who: c.author_id === coachId ? "Vous" : c.first_name,
    init: (c.author_id === coachId ? "V" : String(c.first_name || "?")[0]).toUpperCase(),
    mine: c.author_id === coachId,
    body: c.body,
    when: commentWhen(String(c.created_at || "")),
  });

  const workoutEntry = (w: Workout): CalEntry => {
    const content =
      w.sport === "strength"
        ? strengthBlocksToLines(strengthBlocks.filter((b) => b.workout_id === w.id))
        : intervalsToLines(w.intervals_json);
    const plan = parsePlan(w.plan_json);
    return {
      id: w.id,
      kind: "workout",
      date: w.date,
      title: w.title,
      sport: w.sport,
      sportLabel: plan?.activity ? activityForSport(w.sport, plan).label : SPORT_LABELS[w.sport] || w.sport,
      plan: planSummary(plan),
      status: workoutStatus(w, today),
      isGoal: w.category === "objectif" || w.category === "evenement",
      isDraft: !!w.is_draft,
      plannedMin: w.duration_minutes,
      plannedRpe: w.planned_rpe ?? null,
      realMin: w.actual_duration_minutes ?? (w.status === "done" ? w.duration_minutes : null),
      rpe: w.rpe,
      distanceKm: w.distance_km,
      avgHr: w.avg_hr,
      elevation: w.elevation_gain_m,
      power: w.avg_power_w,
      timeLabel: formatWorkoutTime(w.time) || null,
      description: w.description,
      content,
      feedback: w.athlete_feedback,
      reportedByCoach: w.reported_by === "coach",
      createdByMe: false,
      comments: (comments as CommentRow[]).filter((c) => c.workout_id === w.id).map(toComment),
    };
  };

  const importEntry = (a: ImportedActivity): CalEntry => ({
    id: a.id,
    kind: "import",
    date: a.activity_date,
    title: a.notes?.split("\n")[0]?.slice(0, 60) || SPORT_LABELS[a.sport] || "Activité",
    sport: a.sport,
    sportLabel: SPORT_LABELS[a.sport] || a.sport,
    status: "hors",
    isGoal: false,
    isDraft: false,
    plannedMin: null,
    plannedRpe: null,
    realMin: a.duration_minutes,
    rpe: a.rpe,
    distanceKm: a.distance_km,
    avgHr: a.avg_hr,
    elevation: a.elevation_gain_m,
    power: a.avg_power_w,
    timeLabel: a.activity_time || null,
    description: a.notes,
    content: [],
    plan: [],
    feedback: null,
    reportedByCoach: a.created_by === coachId,
    createdByMe: a.created_by === coachId,
    comments: [],
  });

  // Les activités importées rattachées à une séance programmée ne sont pas
  // comptées deux fois : la séance porte déjà le réalisé.
  const freeImports = imports.filter((a) => !a.workout_id);

  const buildDay = (date: string, inMonth: boolean, i: number): CalDay => {
    const c = checkins.find((x) => x.check_date === date);
    const score = c ? computeGlobalScore(c) : null;
    return {
      date,
      dow: DOW[i],
      num: parse(date).getDate(),
      inMonth,
      isToday: date === today,
      isPast: date < today,
      entries: [
        ...workouts.filter((w) => w.date === date).map(workoutEntry),
        ...freeImports.filter((a) => a.activity_date === date).map(importEntry),
      ],
      blocks: blocks
        .filter((b) => b.date === date)
        .map((b) => ({
          id: b.id,
          label: b.time_of_day === "full_day" ? "Indisponible" : `${AVAILABILITY_SLOT_LABELS[b.time_of_day]} indispo`,
          reason: b.reason,
          createdByMe: b.created_by === coachId,
        })),
      forme:
        c && score != null
          ? {
              score,
              label: scoreLabel(score),
              physical: c.physical_level,
              mental: c.mental_level,
              sleep: c.sleep_quality,
              soreness: c.soreness,
              stress: c.stress,
              notes: c.notes,
            }
          : null,
      cycle: cycleSettings ? cycleDayForDate(periodStarts, cycleSettings, date) : null,
    };
  };

  const weeks: CalWeek[] = weeksDates.map((wk) => {
    const days = wk.map((d, i) => buildDay(d.date, d.inMonth, i));
    let load = 0, plannedLoad = 0, minutes = 0, plannedMinutes = 0, km = 0, done = 0, total = 0;
    const disc: Record<string, number> = {};
    for (const day of days) {
      for (const e of day.entries) {
        if (e.isGoal && e.kind === "workout" && !e.plannedMin) continue;
        const realised = e.status === "done" || e.status === "tovalidate" || e.status === "hors";
        if (e.kind === "workout") {
          total++;
          if (e.status === "done" || e.status === "tovalidate") done++;
          plannedMinutes += e.plannedMin || 0;
          plannedLoad += sessionLoad(e.plannedMin, e.plannedRpe);
        }
        if (realised) {
          const m = e.realMin ?? e.plannedMin ?? 0;
          minutes += m;
          load += sessionLoad(m, e.rpe);
          km += e.distanceKm || 0;
          disc[e.sport] = (disc[e.sport] || 0) + m;
        }
      }
    }
    const mid = wk[3].date;
    const active = periodsOnDate(periods, mid);
    const finest = active[active.length - 1];
    const pos = finest ? weekPosition(finest, mid) : null;
    return {
      weekStart: wk[0].date,
      number: isoWeek(wk[0].date),
      period: finest ? finest.name : null,
      periodLabel: finest ? `${finest.name}${pos ? `, semaine ${pos.week} sur ${pos.totalWeeks}${pos.isDeload ? " (décharge)" : ""}` : ""}` : null,
      load,
      plannedLoad,
      minutes,
      plannedMinutes,
      km: Math.round(km * 10) / 10,
      done,
      total,
      disciplines: Object.keys(disc)
        .sort((a, b) => disc[b] - disc[a])
        .map((k) => ({ label: SPORT_LABELS[k] || k, minutes: disc[k], color: SPORT_COLORS[k] || "#9aa39c" })),
      days,
    };
  });

  return weeks;
}
