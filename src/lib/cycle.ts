import { dbGet, dbAll } from "./db";
import { CyclePhase, CycleEstimate, CycleSettings } from "./cycle-types";

export type { CyclePhase, CycleEstimate, CycleSettings };
export { PHASE_LABELS } from "./cycle-types";

export async function getCycleSettings(athleteId: string): Promise<CycleSettings> {
  const row = await dbGet<CycleSettings>(`SELECT * FROM cycle_sharing_settings WHERE athlete_id = ?`, [athleteId]);
  return (
    row || {
      athlete_id: athleteId,
      share_with_coaches: 0,
      average_cycle_length_days: 28,
      average_period_length_days: 5,
      consent_given_at: null,
    }
  );
}

export async function getCycleEntries(athleteId: string, limit = 12) {
  return dbAll(`SELECT * FROM cycle_entries WHERE athlete_id = ? ORDER BY entry_date DESC LIMIT ?`, [
    athleteId,
    limit,
  ]);
}

// Estimation simple à partir du dernier début de règles connu et des moyennes
// renseignées par l'athlète — volontairement basique pour ce prototype (une
// vraie implémentation croiserait plusieurs cycles passés, cf. README).
export async function estimateCyclePhase(athleteId: string): Promise<CycleEstimate> {
  const settings = await getCycleSettings(athleteId);
  const lastStart = await dbGet<any>(
    `SELECT entry_date FROM cycle_entries WHERE athlete_id = ? AND entry_type = 'period_start' ORDER BY entry_date DESC LIMIT 1`,
    [athleteId]
  );

  if (!lastStart) {
    return { phase: "inconnue", dayOfCycle: null, lastPeriodStart: null };
  }

  const start = new Date(lastStart.entry_date);
  const today = new Date();
  const dayOfCycle = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) % settings.average_cycle_length_days;

  let phase: CyclePhase;
  if (dayOfCycle < settings.average_period_length_days) {
    phase = "menstruelle";
  } else if (dayOfCycle < settings.average_cycle_length_days / 2 - 2) {
    phase = "folliculaire";
  } else if (dayOfCycle < settings.average_cycle_length_days / 2 + 2) {
    phase = "ovulatoire";
  } else {
    phase = "lutéale";
  }

  return { phase, dayOfCycle: dayOfCycle + 1, lastPeriodStart: lastStart.entry_date };
}
