// Découpage du calendrier en 4 créneaux — dérivé directement du champ "heure"
// (workouts.time / imported_activities.activity_time), jamais stocké séparément :
// une entrée est donc reclassée automatiquement si son heure change, sans
// migration de données nécessaire. Les entrées sans heure renseignée sont
// groupées à part plutôt que placées arbitrairement dans un créneau.
export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening";

export const TIME_OF_DAY_ORDER: TimeOfDay[] = ["morning", "midday", "afternoon", "evening"];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "Matin",
  midday: "Midi",
  afternoon: "Après-midi",
  evening: "Soir",
};

export const TIME_OF_DAY_HINTS: Record<TimeOfDay, string> = {
  morning: "5h – 12h",
  midday: "12h – 14h",
  afternoon: "14h – 18h",
  evening: "18h – 5h",
};

// "HH:MM" (ou "HH:MM:SS") -> créneau. Soir couvre aussi la nuit (18h-5h) pour ne
// laisser aucun trou sur 24h. Retourne null si l'heure est absente/invalide —
// à traiter comme "sans horaire" par l'appelant, jamais comme "matin" par défaut.
export function classifyTimeOfDay(time: string | null | undefined): TimeOfDay | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  return "evening";
}

export function groupByTimeOfDay<T>(
  items: T[],
  getTime: (item: T) => string | null | undefined
): { byPhase: Record<TimeOfDay, T[]>; unscheduled: T[] } {
  const byPhase: Record<TimeOfDay, T[]> = { morning: [], midday: [], afternoon: [], evening: [] };
  const unscheduled: T[] = [];
  for (const item of items) {
    const phase = classifyTimeOfDay(getTime(item));
    if (phase) byPhase[phase].push(item);
    else unscheduled.push(item);
  }
  return { byPhase, unscheduled };
}
