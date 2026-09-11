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
