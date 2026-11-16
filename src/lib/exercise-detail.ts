// Aides au détail d'un exercice affiché à l'athlète (sans dépendance serveur).
import { EXERCISE_ANIMATIONS } from "./exercise-animations";

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Animation livrée avec l'application qui correspond au nom de l'exercice
 * (« Goblet squat », « Rowing haltère », « Dead bug »…), ou null. Utilisée
 * quand le coach n'a joint aucune démonstration.
 */
export function animationFor(exerciseName: string): { url: string; title: string; description: string } | null {
  const n = norm(exerciseName);
  if (n.length < 4) return null;
  const exact = EXERCISE_ANIMATIONS.find((a) => norm(a.title) === n);
  const loose =
    exact ??
    EXERCISE_ANIMATIONS.find((a) => {
      const t = norm(a.title);
      return (t.length >= 6 && n.includes(t)) || (n.length >= 6 && t.includes(n));
    });
  return loose ? { url: `/api/exercise-animations/${loose.file}`, title: loose.title, description: loose.description.replace(/\s*\([^)]*\)\s*$/, "") } : null;
}

/** « 3-1-X-0 » → les quatre phases expliquées, ou null si le format n'est pas reconnu. */
export function tempoPhases(tempo: string): { label: string; value: string }[] | null {
  const parts = tempo.split(/[-–/.\s]+/).filter(Boolean);
  if (parts.length !== 4) return null;
  const labels = ["Descente (excentrique)", "Pause en bas", "Montée (concentrique)", "Pause en haut"];
  const val = (p: string) => (/^x$/i.test(p) ? "explosive" : /^\d+$/.test(p) ? (p === "0" ? "aucune" : `${p} s`) : p);
  return parts.map((p, i) => ({ label: labels[i], value: val(p) }));
}

export const QUALITY_TIPS: Record<string, string> = {
  force_max: "Charges lourdes, peu de répétitions : chaque répétition propre et appliquée, récupération complète entre les séries.",
  explosivite: "Charge légère à modérée, mouvement le plus rapide possible à chaque répétition ; on s'arrête dès que la vitesse baisse.",
  force_endurance: "Répétitions nombreuses à charge modérée, récupérations courtes : garder une technique propre malgré la fatigue.",
  cardio: "Effort continu ou enchaîné pour faire monter le cœur : régularité plutôt que charge.",
};

/** Charge prescrite en % (« 80 », « 80% », « 75-80 % ») → kilos avec le max de l'athlète. */
export function loadInKg(load: string, maxKg: number | null | undefined): string | null {
  if (!maxKg) return null;
  const m = load.replace(",", ".").match(/^(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*%?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : null;
  if (a > 100 || (b && b > 100) || (!load.includes("%") && a < 30)) return null;
  const kg = (p: number) => Math.round((maxKg * p) / 100 / 2.5) * 2.5;
  return b ? `${kg(a)}–${kg(b)} kg` : `${kg(a)} kg`;
}
