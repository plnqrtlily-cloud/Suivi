// Agrégations pour le bilan d'entraînement côté coach (charge, volume,
// répartition par sport, évolution du RPE) — calculs purs, séparés du
// rendu pour rester faciles à ajuster/tester.
import type { Workout } from "./queries";
import type { ImportedActivity } from "./queries";
import { toISODate } from "./dates";

export interface RpePoint {
  date: string;
  rpe: number;
  label: string;
}

export interface WeeklyLoadPoint {
  weekStart: string;
  load: number;
}

export interface SportSummary {
  sport: string;
  count: number;
  totalMinutes: number;
  totalDistanceKm: number | null;
  totalElevationM: number | null;
  avgPowerW: number | null;
  avgRpe: number | null;
}

// Charge façon session-RPE (Foster) : durée × intensité ressentie. Seules les
// séances/activités avec un RPE renseigné comptent — pas de charge inventée.
export function sessionLoad(minutes: number | null, rpe: number | null): number {
  if (!minutes || !rpe) return 0;
  return minutes * rpe;
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return toISODate(d);
}

export function computeWeeklyLoad(workouts: Workout[], imports: ImportedActivity[], weeks = 8): WeeklyLoadPoint[] {
  const byWeek: Record<string, number> = {};

  for (const w of workouts) {
    if (w.status !== "done" && w.status !== "partial") continue;
    const minutes = w.actual_duration_minutes ?? w.duration_minutes;
    const load = sessionLoad(minutes, w.rpe);
    if (load > 0) {
      const wk = isoWeekStart(w.date);
      byWeek[wk] = (byWeek[wk] || 0) + load;
    }
  }
  for (const a of imports) {
    const load = sessionLoad(a.duration_minutes, a.rpe);
    if (load > 0) {
      const wk = isoWeekStart(a.activity_date);
      byWeek[wk] = (byWeek[wk] || 0) + load;
    }
  }

  // Toujours `weeks` points, même à zéro, pour un graphique à l'échelle stable.
  const now = new Date();
  const points: WeeklyLoadPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const wk = isoWeekStart(toISODate(d));
    points.push({ weekStart: wk, load: Math.round(byWeek[wk] || 0) });
  }
  return points;
}

export function computeRpeEvolution(workouts: Workout[], imports: ImportedActivity[], limit = 15): RpePoint[] {
  const points: RpePoint[] = [
    ...workouts.filter((w) => w.rpe).map((w) => ({ date: w.date, rpe: w.rpe as number, label: w.title })),
    ...imports.filter((a) => a.rpe).map((a) => ({ date: a.activity_date, rpe: a.rpe as number, label: a.sport })),
  ];
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points.slice(-limit);
}

export function computeSportDistribution(workouts: Workout[], imports: ImportedActivity[]): { sport: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const w of workouts) {
    if (w.status !== "done" && w.status !== "partial") continue;
    counts[w.sport] = (counts[w.sport] || 0) + 1;
  }
  for (const a of imports) {
    counts[a.sport] = (counts[a.sport] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([sport, count]) => ({ sport, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeSportSummaries(workouts: Workout[], imports: ImportedActivity[]): SportSummary[] {
  const bySport: Record<string, { minutes: number; distance: number; hasDistance: boolean; elevation: number; hasElevation: boolean; power: number[]; rpes: number[]; count: number }> = {};

  function bucket(sport: string) {
    return (bySport[sport] ??= { minutes: 0, distance: 0, hasDistance: false, elevation: 0, hasElevation: false, power: [], rpes: [], count: 0 });
  }

  for (const w of workouts) {
    if (w.status !== "done" && w.status !== "partial") continue;
    const b = bucket(w.sport);
    b.count++;
    b.minutes += w.actual_duration_minutes ?? w.duration_minutes ?? 0;
    if (w.rpe) b.rpes.push(w.rpe);
  }
  for (const a of imports) {
    const b = bucket(a.sport);
    b.count++;
    b.minutes += a.duration_minutes || 0;
    if (a.distance_km) {
      b.distance += a.distance_km;
      b.hasDistance = true;
    }
    if (a.elevation_gain_m) {
      b.elevation += a.elevation_gain_m;
      b.hasElevation = true;
    }
    if (a.avg_power_w) b.power.push(a.avg_power_w);
    if (a.rpe) b.rpes.push(a.rpe);
  }

  return Object.entries(bySport)
    .map(([sport, b]) => ({
      sport,
      count: b.count,
      totalMinutes: b.minutes,
      totalDistanceKm: b.hasDistance ? Math.round(b.distance * 10) / 10 : null,
      totalElevationM: b.hasElevation ? Math.round(b.elevation) : null,
      avgPowerW: b.power.length ? Math.round(b.power.reduce((s, v) => s + v, 0) / b.power.length) : null,
      avgRpe: b.rpes.length ? Math.round((b.rpes.reduce((s, v) => s + v, 0) / b.rpes.length) * 10) / 10 : null,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface PeriodSummary {
  totalSessions: number; // séances déjà passées sur la période (tout statut confondu)
  completedSessions: number; // faites ou partielles, parmi les séances passées
  adherenceRate: number | null; // % respect du plan — null si aucune séance passée à comparer
  avgWeeklyMinutes: number; // volume hebdomadaire moyen sur la période (séances faites + activités importées)
  totalDistanceKm: number | null;
  totalLoad: number; // somme des charges session-RPE sur la période
}

// Indicateurs essentiels pour un coup d'œil coach : est-ce que l'athlète suit
// le plan (adhérence), combien il/elle s'entraîne par semaine en moyenne, et
// la charge totale accumulée — au-delà des graphiques détaillés déjà présents.
export function computePeriodSummary(workouts: Workout[], imports: ImportedActivity[], periodDays: number, today: string): PeriodSummary {
  const pastWorkouts = workouts.filter((w) => w.date <= today);
  const completed = pastWorkouts.filter((w) => w.status === "done" || w.status === "partial");
  const adherenceRate = pastWorkouts.length > 0 ? Math.round((completed.length / pastWorkouts.length) * 100) : null;

  let totalMinutes = 0;
  let totalLoad = 0;
  let totalDistance = 0;
  let hasDistance = false;

  for (const w of completed) {
    const minutes = w.actual_duration_minutes ?? w.duration_minutes ?? 0;
    totalMinutes += minutes;
    totalLoad += sessionLoad(minutes, w.rpe);
    if (w.distance_km) {
      totalDistance += w.distance_km;
      hasDistance = true;
    }
  }
  for (const a of imports) {
    totalMinutes += a.duration_minutes || 0;
    totalLoad += sessionLoad(a.duration_minutes, a.rpe);
    if (a.distance_km) {
      totalDistance += a.distance_km;
      hasDistance = true;
    }
  }

  const weeks = periodDays / 7;
  return {
    totalSessions: pastWorkouts.length,
    completedSessions: completed.length,
    adherenceRate,
    avgWeeklyMinutes: Math.round(totalMinutes / weeks),
    totalDistanceKm: hasDistance ? Math.round(totalDistance * 10) / 10 : null,
    totalLoad: Math.round(totalLoad),
  };
}
