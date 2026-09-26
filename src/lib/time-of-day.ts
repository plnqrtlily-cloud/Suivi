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

// Créneaux pour les indisponibilités de l'athlète uniquement : "journée
// entière" s'ajoute aux 4 créneaux ci-dessus (qui, eux, restent réservés au
// classement des séances/activités par heure — un "full_day" n'aurait aucun
// sens dérivé d'un champ "heure").
export type AvailabilitySlot = TimeOfDay | "full_day";

export const AVAILABILITY_SLOT_ORDER: AvailabilitySlot[] = [...TIME_OF_DAY_ORDER, "full_day"];

export const AVAILABILITY_SLOT_LABELS: Record<AvailabilitySlot, string> = {
  ...TIME_OF_DAY_LABELS,
  full_day: "Journée entière",
};

// Un coach qui programme une séance ne connaît pas toujours l'heure exacte —
// seulement "dans la matinée" ou "en soirée". Plutôt qu'une colonne séparée,
// workouts.time (TEXT libre, sans contrainte) accepte aussi directement un de
// ces 4 mots-clés à la place d'une heure "HH:MM" (cf. workout-form.tsx) :
// classifyTimeOfDay et le groupement par créneau les reconnaissent tels quels,
// sans qu'aucune migration ne soit nécessaire.
export function isTimeOfDaySlug(value: string): value is TimeOfDay {
  return (TIME_OF_DAY_ORDER as string[]).includes(value);
}

// Heure représentative de chaque créneau — UNIQUEMENT pour les besoins qui
// exigent une heure réelle (tri chronologique, export ICS). Jamais affichée
// telle quelle : l'utilisateur ne voit que le nom du créneau (cf.
// formatWorkoutTime), pas une fausse précision qu'on ne lui a pas donnée.
const TIME_OF_DAY_REPRESENTATIVE_HOUR: Record<TimeOfDay, string> = {
  morning: "08:00",
  midday: "12:30",
  afternoon: "15:00",
  evening: "19:00",
};

/** "HH:MM" (ou "HH:MM:SS") ou créneau -> créneau. Soir couvre aussi la nuit
 * (18h-5h) pour ne laisser aucun trou sur 24h. Retourne null si l'heure est
 * absente/invalide — à traiter comme "sans horaire" par l'appelant, jamais
 * comme "matin" par défaut. */
export function classifyTimeOfDay(time: string | null | undefined): TimeOfDay | null {
  if (!time) return null;
  if (isTimeOfDaySlug(time)) return time;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  return "evening";
}

/** Convertit workouts.time (heure précise OU créneau) en "HH:MM" exploitable
 * pour un tri chronologique ou un calcul de date (ICS) — jamais pour
 * l'affichage brut, qui doit passer par formatWorkoutTime. */
export function resolveTimeForSort(time: string | null | undefined): string {
  if (!time) return "99:99";
  if (isTimeOfDaySlug(time)) return TIME_OF_DAY_REPRESENTATIVE_HOUR[time];
  return time;
}

/** Libellé à afficher pour workouts.time : l'heure telle quelle si précise, le
 * nom du créneau si c'en est un, chaîne vide si rien n'est renseigné. */
export function formatWorkoutTime(time: string | null | undefined): string {
  if (!time) return "";
  return isTimeOfDaySlug(time) ? TIME_OF_DAY_LABELS[time] : time;
}

/** Comme formatWorkoutTime, mais ne renvoie que les heures précises — utile
 * dans une vue déjà groupée par créneau (cf. groupByTimeOfDay), où répéter le
 * nom du créneau à côté de chaque séance qu'il contient serait redondant. */
export function formatPreciseTime(time: string | null | undefined): string {
  if (!time || isTimeOfDaySlug(time)) return "";
  return time;
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
