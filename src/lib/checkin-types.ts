// Types purs + calcul du score, séparés de la lecture/écriture en base (cycle-types.ts
// suit le même principe) pour rester importables depuis un composant client sans
// entraîner better-sqlite3 dans le bundle navigateur.

export interface CheckinValues {
  physical_level: number;
  mental_level: number;
  sleep_quality: number;
  soreness: number;
  stress: number;
}

export interface Checkin extends CheckinValues {
  id: string;
  athlete_id: string;
  check_date: string;
  notes: string | null;
  updated_at: string;
}

// --- Base scientifique ---
// Le calcul suit le principe du questionnaire de bien-être de Hooper & Mackinnon
// (Hooper SL, Mackinnon LT. "Monitoring overtraining in athletes: recommendations."
// Sports Medicine, 1995) : sommer plusieurs indicateurs subjectifs simples
// (sommeil, fatigue, stress, courbatures) évalués sur une échelle de Likert donne un
// indice de bien-être global fiable pour le suivi de charge d'entraînement. Une revue
// systématique ultérieure (Saw AE, Main LC, Gastin PB. "Monitoring the athlete
// training response: subjective self-reported measures trump commonly used
// objective measures." British Journal of Sports Medicine, 2016) confirme que ces
// mesures auto-rapportées simples sont au moins aussi sensibles que des mesures
// physiologiques objectives pour détecter la fatigue et la sous-récupération.
//
// Le questionnaire original utilise 4 items sur une échelle de 1 à 7 (sommeil,
// fatigue, stress, courbatures), sommés en un "indice de Hooper" où un score plus
// élevé signifie un moins bon état (moins bon = pire). Nous l'étendons ici à 5 items
// sur une échelle de 1 à 10 (ajout d'un item "forme mentale/motivation", extension
// courante en pratique de terrain), en conservant le même principe : convertir
// chaque item sur une polarité commune ("sévérité", où une valeur haute est
// défavorable), puis les sommer.

// Indice de Hooper étendu (5-50) : plus BAS = meilleur état. C'est la mesure de
// référence, directement comparable dans le temps pour un même athlète.
export function computeHooperIndex(v: CheckinValues): number {
  const severity = [
    11 - v.physical_level, // forme physique basse = sévérité haute
    11 - v.mental_level, // forme mentale basse = sévérité haute
    11 - v.sleep_quality, // sommeil de mauvaise qualité = sévérité haute
    v.soreness, // courbatures déjà sur l'échelle de sévérité
    v.stress, // stress déjà sur l'échelle de sévérité
  ];
  return severity.reduce((a, b) => a + b, 0);
}

// Score de forme sur 10, dérivé linéairement de l'indice de Hooper (5 = meilleur
// état possible -> 10/10 ; 50 = pire état possible -> 0/10), pour un affichage
// immédiatement lisible sans devoir interpréter l'indice brut.
export function computeGlobalScore(v: CheckinValues): number {
  const hooper = computeHooperIndex(v);
  const score = 10 - ((hooper - 5) / (50 - 5)) * 10;
  return Math.round(score * 10) / 10;
}

export function scoreLabel(score: number): string {
  if (score >= 8) return "Excellente forme";
  if (score >= 6) return "Bonne forme";
  if (score >= 4) return "Forme moyenne";
  return "Fatigue importante";
}

export function scoreColor(score: number): string {
  if (score >= 8) return "text-moss-dark";
  if (score >= 6) return "text-moss";
  if (score >= 4) return "text-status-partial";
  return "text-clay";
}
