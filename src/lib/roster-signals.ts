import { getWorkoutsForAthlete, getImportedActivitiesForRange, getRecentCheckins } from "./queries";
import { computeAcwr } from "./training-stats";
import { toISODate, daysUntil } from "./dates";
import type { Workout } from "./queries";

export interface RosterSignals {
  acwrHighRisk: boolean;
  acwrRatio: number | null;
  daysSinceCheckin: number | null;
  missedRecently: number;
  // Séances passées dont l'athlète n'a rien dit — ni fait, ni pas fait.
  unvalidatedRecently: number;
  // Jours avant la prochaine séance prévue ; null si plus rien de programmé.
  daysUntilNextWorkout: number | null;
  nextWorkout: Workout | null;
}

// Signaux à traiter en priorité — plutôt qu'une simple liste de noms, faire
// remonter qui a besoin d'attention avant de cliquer sur chaque fiche une
// par une : pertinent dès qu'un coach suit plus de quelques athlètes.
export async function getRosterSignals(athleteId: string, today: string): Promise<RosterSignals> {
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
  const recentPast = workouts.filter((w) => w.date >= recentFromISO && w.date < today);
  const missedRecently = recentPast.filter((w) => w.status === "not_done").length;
  // "planned" sur une date passée = l'athlète n'a jamais dit ce qu'il en a fait.
  const unvalidatedRecently = recentPast.filter((w) => w.status === "planned").length;

  const futureWorkouts = workouts
    .filter((w) => w.date >= today && w.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextWorkout = futureWorkouts[0] ?? null;

  return {
    acwrHighRisk: acwr.status === "high_risk",
    acwrRatio: acwr.ratio ?? null,
    daysSinceCheckin: lastCheckin ? -daysUntil(lastCheckin.check_date) : null,
    missedRecently,
    unvalidatedRecently,
    daysUntilNextWorkout: nextWorkout ? daysUntil(nextWorkout.date) : null,
    nextWorkout,
  };
}

// Score d'urgence, du plus au moins grave — sert à trier la liste des athlètes.
export function signalScore(s?: RosterSignals): number {
  if (!s) return 0;
  return (
    (s.acwrHighRisk ? 5 : 0) +
    (s.missedRecently > 0 ? 3 : 0) +
    (s.daysUntilNextWorkout === null ? 2 : 0) +
    (s.unvalidatedRecently > 0 ? 2 : 0) +
    (s.daysSinceCheckin !== null && s.daysSinceCheckin > 3 ? 1 : 0)
  );
}
