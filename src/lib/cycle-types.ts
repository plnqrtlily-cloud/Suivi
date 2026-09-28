// Types purs, sans import de `db` — ce fichier peut être importé en toute
// sécurité par des composants client (cf. src/lib/cycle.ts pour la logique
// serveur qui s'appuie sur ces types).

export type CyclePhase = "menstruelle" | "folliculaire" | "ovulatoire" | "lutéale" | "inconnue";

export interface CycleEstimate {
  phase: CyclePhase;
  dayOfCycle: number | null;
  lastPeriodStart: string | null;
}

export interface CycleSettings {
  athlete_id: string;
  share_with_coaches: number;
  average_cycle_length_days: number;
  average_period_length_days: number;
  consent_given_at: string | null;
}

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstruelle: "Phase menstruelle",
  folliculaire: "Phase folliculaire",
  ovulatoire: "Phase ovulatoire",
  lutéale: "Phase lutéale",
  inconnue: "Non renseigné",
};

// --- Phase à une date quelconque ---------------------------------------------
// Le calendrier affiche la phase jour par jour : on part du dernier début de
// règles connu à cette date (ou du plus ancien pour une date antérieure), et
// on projette avec la durée moyenne du cycle. Mêmes seuils que
// estimateCyclePhase pour que l'aperçu et le calendrier disent la même chose.

export type CycleDayKey = "regles" | "foll" | "ovu" | "lut";

export interface CycleDay {
  day: number;
  key: CycleDayKey;
  /** Nom court affiché dans la case (« Règles », « Lutéale »…). */
  short: string;
  /** Phrase complète pour le détail du jour. */
  text: string;
  /** Premier jour de la phase : sert à n'afficher le nom qu'une fois en vue mois. */
  first: boolean;
}

const DAY_MS = 86400000;

function isoToUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function cycleDayForDate(
  periodStarts: string[],
  settings: Pick<CycleSettings, "average_cycle_length_days" | "average_period_length_days">,
  dateISO: string
): CycleDay | null {
  if (periodStarts.length === 0) return null;
  const sorted = [...periodStarts].sort();
  const before = sorted.filter((s) => s <= dateISO);
  const anchor = before.length ? before[before.length - 1] : sorted[0];
  const len = settings.average_cycle_length_days || 28;
  const periodLen = settings.average_period_length_days || 5;
  const diff = Math.round((isoToUTC(dateISO) - isoToUTC(anchor)) / DAY_MS);
  const idx = ((diff % len) + len) % len; // 0-indexé
  let key: CycleDayKey;
  if (idx < periodLen) key = "regles";
  else if (idx < len / 2 - 2) key = "foll";
  else if (idx < len / 2 + 2) key = "ovu";
  else key = "lut";
  const firstIdx = key === "regles" ? 0 : key === "foll" ? periodLen : key === "ovu" ? Math.ceil(len / 2 - 2) : Math.ceil(len / 2 + 2);
  const names: Record<CycleDayKey, [string, string]> = {
    regles: ["Règles", "Règles"],
    foll: ["Folliculaire", "Phase folliculaire"],
    ovu: ["Ovulation", "Ovulation estimée"],
    lut: ["Lutéale", "Phase lutéale"],
  };
  return { day: idx + 1, key, short: names[key][0], text: `${names[key][1]}, jour ${idx + 1} sur ${len}`, first: idx === firstIdx };
}

export const CYCLE_DAY_STYLE: Record<CycleDayKey, { dot: string; text: string; note: string }> = {
  regles: { dot: "#c98aa2", text: "#8c4a64", note: "Fatigue et crampes possibles les premiers jours." },
  foll: { dot: "#8fb3a0", text: "#3f6552", note: "Phase souvent bien tolérée pour les séances intenses." },
  ovu: { dot: "#e3b75c", text: "#7a5a12", note: "Fenêtre estimée ; certaines études évoquent une laxité articulaire accrue." },
  lut: { dot: "#b8a1cc", text: "#5d4f86", note: "Effort parfois perçu plus dur et récupération plus lente en fin de phase." },
};
