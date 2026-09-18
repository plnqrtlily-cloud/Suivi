// Indicateurs de volume d'une séance de musculation, calculés en direct
// pendant que le coach construit — pour qu'il voie immédiatement si la séance
// est trop légère ou trop lourde, plutôt que de s'en apercevoir après coup.

export interface VolumeSetInput {
  reps: string;
  load: string;
  rir?: string;
  rpe?: string;
}

export interface VolumeExerciseInput {
  exercise_name: string;
  rep_type: "reps" | "time";
  circuit_id?: string;
  circuit_rounds?: number;
  sets: VolumeSetInput[];
}

export interface VolumeSummary {
  /** Nombre total de séries effectuées, répétitions de série comprises. */
  totalSets: number;
  /** Somme des répétitions prescrites (exercices minutés exclus). */
  totalReps: number;
  /** Tonnage : somme de (répétitions x charge) en kg. */
  totalLoadKg: number;
  /** Durée cumulée des exercices prescrits en temps, en secondes. */
  totalTimeSeconds: number;
  /** Nombre d'exercices distincts. */
  exerciseCount: number;
  /** Vrai si au moins une charge est en % sans max connu : le tonnage est alors partiel. */
  hasUnresolvedPercent: boolean;
}

/**
 * Convertit une charge saisie en kilogrammes.
 * Accepte "80" (kg), "80kg", "75%" (du max connu pour cet exercice).
 * Renvoie null si la valeur n'est pas exploitable — notamment un pourcentage
 * sans max de référence, auquel cas le tonnage serait faux plutôt qu'absent.
 */
export function resolveLoadKg(load: string, maxKg?: number): number | null {
  const raw = (load || "").trim().replace(",", ".");
  if (!raw) return null;

  const percent = raw.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    if (!maxKg) return null;
    return (Number(percent[1]) / 100) * maxKg;
  }

  const kg = raw.match(/^(\d+(?:\.\d+)?)\s*(kg)?$/i);
  if (kg) return Number(kg[1]);

  // "au poids du corps", "élastique"… : pas de tonnage chiffrable.
  return null;
}

/** "45" ou "45s" -> 45 ; "1:30" -> 90 ; "2min" -> 120. */
export function parseDurationSeconds(value: string): number {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return 0;

  const mmss = raw.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);

  const min = raw.match(/^(\d+(?:[.,]\d+)?)\s*(min|m)$/);
  if (min) return Math.round(Number(min[1].replace(",", ".")) * 60);

  const sec = raw.match(/^(\d+)\s*(s|sec|")?$/);
  if (sec) return Number(sec[1]);

  return 0;
}

/** "8" -> 8 ; "8-10" -> 9 (moyenne, pour ne pas surestimer une fourchette). */
export function parseReps(value: string): number {
  const raw = (value || "").trim();
  if (!raw) return 0;

  const range = raw.match(/^(\d+)\s*[-–à]\s*(\d+)$/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);

  const single = raw.match(/^(\d+)/);
  return single ? Number(single[1]) : 0;
}

/**
 * Agrège le volume d'une séance. Les exercices d'une même série (circuit_id
 * partagé) sont comptés autant de fois que la série est répétée.
 */
export function computeVolume(
  exercises: VolumeExerciseInput[],
  maxesByExercise: Record<string, number> = {}
): VolumeSummary {
  let totalSets = 0;
  let totalReps = 0;
  let totalLoadKg = 0;
  let totalTimeSeconds = 0;
  let hasUnresolvedPercent = false;

  for (const ex of exercises) {
    if (!ex.exercise_name.trim()) continue;
    // Un exercice hors série compte une fois ; dans une série répétée N fois,
    // il compte N fois.
    const rounds = ex.circuit_id ? Math.max(1, ex.circuit_rounds ?? 1) : 1;
    const maxKg = maxesByExercise[ex.exercise_name.trim()];

    for (const set of ex.sets) {
      const hasContent = set.reps?.trim() || set.load?.trim();
      if (!hasContent) continue;

      totalSets += rounds;

      if (ex.rep_type === "time") {
        totalTimeSeconds += parseDurationSeconds(set.reps) * rounds;
        continue;
      }

      const reps = parseReps(set.reps);
      totalReps += reps * rounds;

      const loadKg = resolveLoadKg(set.load, maxKg);
      if (loadKg === null) {
        if ((set.load || "").includes("%")) hasUnresolvedPercent = true;
      } else {
        totalLoadKg += reps * loadKg * rounds;
      }
    }
  }

  return {
    totalSets,
    totalReps,
    totalLoadKg: Math.round(totalLoadKg),
    totalTimeSeconds,
    exerciseCount: exercises.filter((e) => e.exercise_name.trim()).length,
    hasUnresolvedPercent,
  };
}

export function formatSeconds(total: number): string {
  if (total <= 0) return "—";
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${String(s).padStart(2, "0")}`;
}
