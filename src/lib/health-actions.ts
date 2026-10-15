"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { dbAll, dbBatch, dbGet, dbRun } from "./db";
import { getCurrentUser, isCoachLinkedToAthlete, type User } from "./auth";
import { createNotification } from "./notifications";
import { todayISO } from "./dates";
import { HEALTH_CATEGORY_LABEL, type HealthCategory, type TrainingImpact } from "./health";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES: HealthCategory[] = ["blessure", "maladie", "etat"];
const IMPACTS: TrainingImpact[] = ["normal", "gene", "stop"];

// L'athlète concerné ou l'un de ses coachs actifs, sinon refus.
async function requireReportAccess(injuryId: string): Promise<{ user: User; athleteId: string; zone: string; category: HealthCategory }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  const row = await dbGet<{ athlete_id: string; zone: string; category: string | null }>(
    `SELECT athlete_id, zone, category FROM injuries WHERE id = ?`,
    [injuryId]
  );
  if (!row) throw new Error("Introuvable.");
  const ok = user.role === "athlete" ? row.athlete_id === user.id : await isCoachLinkedToAthlete(user.id, row.athlete_id);
  if (!ok) throw new Error("Non autorisé.");
  return { user, athleteId: row.athlete_id, zone: row.zone, category: (row.category as HealthCategory) || "blessure" };
}

async function activeCoachIds(athleteId: string): Promise<string[]> {
  const rows = await dbAll<{ coach_id: string }>(
    `SELECT coach_id FROM coach_athlete_links WHERE athlete_id = ? AND status = 'active'`,
    [athleteId]
  );
  return rows.map((r) => r.coach_id);
}

// Prévient l'autre partie : l'athlète écrit → ses coachs ; un coach écrit → l'athlète.
async function notifyOtherSide(user: User, athleteId: string, title: string, body: string, injuryId: string) {
  const targets = user.role === "athlete" ? await activeCoachIds(athleteId) : [athleteId];
  await Promise.all(
    targets.map((userId) => createNotification({ userId, type: "message", title, body, link: `/sante/${injuryId}` }))
  );
}

function revalidateHealth(athleteId: string, injuryId?: string) {
  revalidatePath("/athlete");
  revalidatePath("/athlete/profile");
  revalidatePath(`/coach/athletes/${athleteId}`);
  if (injuryId) revalidatePath(`/sante/${injuryId}`);
}

export async function reportHealthAction(formData: FormData): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const category = String(formData.get("category") || "") as HealthCategory;
  if (!CATEGORIES.includes(category)) return { error: "Choisissez blessure, maladie ou état." };
  const zone = String(formData.get("title") || "").trim().slice(0, 200);
  if (!zone) {
    return { error: category === "blessure" ? "Indiquez où vous avez mal." : category === "maladie" ? "Indiquez ce que vous avez." : "Décrivez ce qui se passe." };
  }
  const detail = String(formData.get("detail") || "").trim().slice(0, 500);
  const dateStart = String(formData.get("dateStart") || todayISO());
  const dateEnd = String(formData.get("dateEnd") || "");
  if (!ISO.test(dateStart)) return { error: "Indiquez depuis quand." };
  if (dateEnd && (!ISO.test(dateEnd) || dateEnd < dateStart)) return { error: "La date de fin doit suivre la date de début." };
  const painRaw = formData.get("pain");
  const pain = category === "blessure" && painRaw !== null && painRaw !== "" ? Math.max(0, Math.min(10, Math.round(Number(painRaw)))) : null;
  const doctor = formData.get("doctorSeen");
  const doctorSeen = category === "maladie" && doctor !== null && doctor !== "" ? (doctor === "1" ? 1 : 0) : null;
  const impactRaw = String(formData.get("trainingImpact") || "");
  const trainingImpact = IMPACTS.includes(impactRaw as TrainingImpact) ? impactRaw : null;
  const notes = String(formData.get("notes") || "").trim().slice(0, 2000);

  const id = randomUUID();
  const label = HEALTH_CATEGORY_LABEL[category].toLowerCase();
  const summary = `${user.first_name} a signalé ${category === "etat" ? "un état" : category === "maladie" ? "une maladie" : "une blessure"}${pain != null ? ` · douleur ${pain}` : ""}`;
  await dbBatch([
    {
      sql: `INSERT INTO injuries (id, athlete_id, zone, description, date_start, date_end, pain, category, training_impact, doctor_seen, reported_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.id, zone, detail || null, dateStart, category === "etat" ? dateEnd || null : null, pain, category, trainingImpact, doctorSeen, user.id],
    },
    { sql: `INSERT INTO health_messages (id, injury_id, author_id, kind, body, pain) VALUES (?, ?, ?, 'created', ?, ?)`, args: [randomUUID(), id, user.id, summary, pain] },
    ...(notes
      ? [{ sql: `INSERT INTO health_messages (id, injury_id, author_id, kind, body, created_at) VALUES (?, ?, ?, 'message', ?, datetime('now', '+1 second'))`, args: [randomUUID(), id, user.id, notes] }]
      : []),
  ]);

  await notifyOtherSide(user, user.id, `${user.first_name} signale ${category === "etat" ? "un état" : `une ${label}`}`, zone, id);
  revalidateHealth(user.id, id);
  return { id };
}

export async function sendHealthMessageAction(injuryId: string, body: string): Promise<{ ok: true } | { error: string }> {
  const { user, athleteId, zone } = await requireReportAccess(injuryId);
  const text = body.trim().slice(0, 2000);
  if (!text) return { error: "Message vide." };
  await dbRun(`INSERT INTO health_messages (id, injury_id, author_id, kind, body) VALUES (?, ?, ?, 'message', ?)`, [randomUUID(), injuryId, user.id, text]);
  await notifyOtherSide(user, athleteId, `${user.first_name} · ${zone}`, text.length > 120 ? `${text.slice(0, 117)}…` : text, injuryId);
  revalidateHealth(athleteId, injuryId);
  return { ok: true };
}

export async function notePainAction(injuryId: string, pain: number): Promise<{ ok: true } | { error: string }> {
  const { user, athleteId, zone } = await requireReportAccess(injuryId);
  if (user.role !== "athlete") throw new Error("Non autorisé.");
  const value = Math.max(0, Math.min(10, Math.round(pain)));
  if (!Number.isFinite(value)) return { error: "Douleur invalide." };
  const today = todayISO();
  await dbBatch([
    { sql: `INSERT INTO injury_followups (id, injury_id, follow_date, pain, note) VALUES (?, ?, ?, ?, NULL)`, args: [randomUUID(), injuryId, today, value] },
    { sql: `INSERT INTO health_messages (id, injury_id, author_id, kind, body, pain) VALUES (?, ?, ?, 'pain', ?, ?)`, args: [randomUUID(), injuryId, user.id, `Douleur notée : ${value}`, value] },
  ]);
  await notifyOtherSide(user, athleteId, `${user.first_name} · ${zone}`, `Douleur notée : ${value}/10`, injuryId);
  revalidateHealth(athleteId, injuryId);
  return { ok: true };
}

export async function resolveHealthAction(injuryId: string): Promise<{ ok: true }> {
  const { user, athleteId, zone, category } = await requireReportAccess(injuryId);
  const today = todayISO();
  await dbBatch([
    { sql: `UPDATE injuries SET date_end = ? WHERE id = ?`, args: [today, injuryId] },
    ...(category === "blessure"
      ? [{ sql: `INSERT INTO injury_followups (id, injury_id, follow_date, pain, note) VALUES (?, ?, ?, 0, ?)`, args: [randomUUID(), injuryId, today, "Guérie."] }]
      : []),
    {
      sql: `INSERT INTO health_messages (id, injury_id, author_id, kind, body) VALUES (?, ?, ?, 'healed', ?)`,
      args: [randomUUID(), injuryId, user.id, category === "etat" ? `${user.first_name} a indiqué que c'est terminé` : `${user.first_name} a indiqué que c'est guéri`],
    },
  ]);
  await notifyOtherSide(user, athleteId, `${user.first_name} · ${zone}`, category === "etat" ? "C'est terminé." : "C'est guéri.", injuryId);
  revalidateHealth(athleteId, injuryId);
  return { ok: true };
}
