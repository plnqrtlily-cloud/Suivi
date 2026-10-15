// Signalements de santé (blessure, maladie, état) et leur fil d'échange
// coach/athlète. Les signalements vivent dans la table `injuries` (que l'onglet
// Santé du coach lit déjà), distingués par `category` ; le fil dans
// `health_messages`.
import { dbAll, dbGet } from "./db";

export type HealthCategory = "blessure" | "maladie" | "etat";
export type TrainingImpact = "normal" | "gene" | "stop";

export const HEALTH_CATEGORY_LABEL: Record<HealthCategory, string> = {
  blessure: "Blessure",
  maladie: "Maladie",
  etat: "État",
};

export const TRAINING_IMPACT_LABEL: Record<TrainingImpact, string> = {
  normal: "entraînement normal",
  gene: "entraînement avec gêne",
  stop: "pas d'entraînement",
};

export interface HealthReport {
  id: string;
  athlete_id: string;
  category: HealthCategory;
  zone: string;
  description: string | null;
  pain: number | null;
  date_start: string;
  date_end: string | null;
  doctor_seen: number | null;
  training_impact: TrainingImpact | null;
  reported_by: string | null;
  created_at: string;
}

export interface HealthMessage {
  id: string;
  injury_id: string;
  author_id: string;
  author_first_name: string;
  author_role: "coach" | "athlete";
  kind: "message" | "created" | "pain" | "healed";
  body: string | null;
  pain: number | null;
  read_at: string | null;
  created_at: string;
}

const REPORT_COLS = `id, athlete_id, COALESCE(category, 'blessure') as category, zone, description, pain, date_start, date_end,
  doctor_seen, training_impact, reported_by, created_at`;

export async function getHealthReport(id: string): Promise<HealthReport | undefined> {
  return dbGet(`SELECT ${REPORT_COLS} FROM injuries WHERE id = ?`, [id]);
}

// En cours = pas encore guéri, ou une fin prévue qui n'est pas passée (un état
// déclaré « du … au … »).
export async function getOngoingHealthReports(athleteId: string, today: string): Promise<HealthReport[]> {
  return dbAll(
    `SELECT ${REPORT_COLS} FROM injuries
     WHERE athlete_id = ? AND date_start <= ? AND (date_end IS NULL OR date_end >= ?)
     ORDER BY date_start DESC`,
    [athleteId, today, today]
  );
}

export async function getHealthMessages(injuryId: string): Promise<HealthMessage[]> {
  return dbAll(
    `SELECT m.id, m.injury_id, m.author_id, u.first_name as author_first_name, u.role as author_role,
            m.kind, m.body, m.pain, m.read_at, m.created_at
     FROM health_messages m JOIN users u ON u.id = m.author_id
     WHERE m.injury_id = ? ORDER BY m.created_at ASC, m.rowid ASC`,
    [injuryId]
  );
}

// Points de douleur dans l'ordre : la valeur du signalement puis chaque suivi.
export async function getPainHistory(injuryId: string): Promise<{ date: string; pain: number }[]> {
  const base = await dbGet<{ date_start: string; pain: number | null }>(`SELECT date_start, pain FROM injuries WHERE id = ?`, [injuryId]);
  if (!base) return [];
  const rows = await dbAll<{ follow_date: string; pain: number }>(
    `SELECT follow_date, pain FROM injury_followups WHERE injury_id = ? ORDER BY follow_date, created_at`,
    [injuryId]
  );
  const pts = base.pain != null ? [{ date: base.date_start, pain: base.pain }] : [];
  return [...pts, ...rows.map((r) => ({ date: r.follow_date, pain: r.pain }))];
}

// Messages non lus par `userId` (écrits par quelqu'un d'autre), par signalement.
export async function getUnreadHealthCounts(injuryIds: string[], userId: string): Promise<Record<string, number>> {
  if (!injuryIds.length) return {};
  const rows = await dbAll<{ injury_id: string; n: number }>(
    `SELECT injury_id, COUNT(*) as n FROM health_messages
     WHERE injury_id IN (${injuryIds.map(() => "?").join(",")}) AND author_id != ? AND read_at IS NULL AND kind = 'message'
     GROUP BY injury_id`,
    [...injuryIds, userId]
  );
  return Object.fromEntries(rows.map((r) => [r.injury_id, Number(r.n)]));
}
