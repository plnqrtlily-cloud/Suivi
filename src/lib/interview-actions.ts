"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser, isCoachLinkedToAthlete } from "./auth";
import { dbGet, dbRun, dbBatch } from "./db";
import { todayISO } from "./dates";
import { summarizeInterview, cleanSummary, type InterviewSummary } from "./interview-ai";

async function coachFor(athleteId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach" || !(await isCoachLinkedToAthlete(user.id, athleteId))) throw new Error("Non autorisé.");
  return user;
}

async function ownInterview(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  const row = await dbGet<{ id: string; athlete_id: string; transcript: string; summary_json: string | null; created_at: string }>(
    `SELECT id, athlete_id, transcript, summary_json, created_at FROM interviews WHERE id = ? AND coach_id = ?`,
    [id, user.id]
  );
  if (!row) throw new Error("Entretien introuvable.");
  return { user, row };
}

async function summarizeAndStore(id: string, athleteId: string, transcript: string) {
  const a = await dbGet<{ first_name: string }>(`SELECT first_name FROM users WHERE id = ?`, [athleteId]);
  const summary = await summarizeInterview(transcript, a?.first_name ?? "l'athlète", todayISO());
  await dbRun(`UPDATE interviews SET summary_json = ? WHERE id = ?`, [JSON.stringify(summary), id]);
  return summary;
}

/**
 * Enregistre la transcription d'un entretien puis lance le résumé. La
 * transcription est gardée même si le résumé échoue (on pourra relancer).
 */
export async function saveInterviewAction(athleteId: string, transcript: string): Promise<{ id: string; summary?: InterviewSummary; error?: string }> {
  const user = await coachFor(athleteId);
  const text = transcript.trim();
  if (text.length < 20) return { id: "", error: "La transcription est trop courte pour être résumée." };
  const id = randomUUID();
  await dbRun(`INSERT INTO interviews (id, coach_id, athlete_id, transcript) VALUES (?, ?, ?, ?)`, [id, user.id, athleteId, text]);
  revalidatePath(`/coach/athletes/${athleteId}`);
  try {
    return { id, summary: await summarizeAndStore(id, athleteId, text) };
  } catch (e) {
    return { id, error: e instanceof Error ? e.message : "Le résumé a échoué." };
  }
}

export async function resummarizeInterviewAction(id: string): Promise<{ summary?: InterviewSummary; error?: string }> {
  const { row } = await ownInterview(id);
  try {
    const summary = await summarizeAndStore(id, row.athlete_id, row.transcript);
    revalidatePath(`/coach/athletes/${row.athlete_id}`);
    return { summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Le résumé a échoué." };
  }
}

export async function deleteInterviewAction(id: string) {
  const { user, row } = await ownInterview(id);
  await dbRun(`DELETE FROM interviews WHERE id = ? AND coach_id = ?`, [id, user.id]);
  revalidatePath(`/coach/athletes/${row.athlete_id}`);
}

export interface ApplyPicks {
  profil: boolean;
  sports: boolean;
  genre: boolean;
  mesures: number[];
  charges: number[];
  antecedents: number[];
}

// « AAAA-MM » ou « AAAA-MM-JJ » → date complète ; sinon null.
function fullDate(v: string | null | undefined) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
  if (/^\d{4}$/.test(v)) return `${v}-01-01`;
  return null;
}

/** Reporte au profil de l'athlète ce que le coach a coché dans le résumé. */
export async function applyInterviewAction(id: string, picks: ApplyPicks) {
  const { user, row } = await ownInterview(id);
  if (!row.summary_json) throw new Error("Pas encore de résumé à reporter.");
  const s = cleanSummary(JSON.parse(row.summary_json));
  const athleteId = row.athlete_id;
  const day = row.created_at.slice(0, 10);
  const stmts: { sql: string; args: (string | number | null)[] }[] = [];

  if (picks.profil) {
    // Le résumé et le portrait rejoignent les notes du coach (onglet Notes).
    const p = s.profil;
    const body = [
      "Entretien — résumé",
      s.resume,
      p.contexte && `Contexte : ${p.contexte}`,
      p.objectifs && `Objectifs : ${p.objectifs}`,
      p.contraintes && `Contraintes : ${p.contraintes}`,
      p.points_forts && `Points forts : ${p.points_forts}`,
      p.points_faibles && `Points faibles : ${p.points_faibles}`,
      s.sports_detail && `Pratique : ${s.sports_detail}`,
      s.a_suivre.length ? `À suivre :\n${s.a_suivre.map((x) => `• ${x}`).join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    stmts.push({ sql: `INSERT INTO coach_note_entries (id, coach_id, athlete_id, entry_date, body, kind) VALUES (?, ?, ?, ?, ?, 'entretien')`, args: [randomUUID(), user.id, athleteId, day, body] });
  }
  if (picks.sports && s.sports.length) {
    const cur = await dbGet<{ sports_json: string | null }>(`SELECT sports_json FROM users WHERE id = ?`, [athleteId]);
    let had: string[] = [];
    try {
      had = cur?.sports_json ? JSON.parse(cur.sports_json) : [];
    } catch {}
    stmts.push({ sql: `UPDATE users SET sports_json = ? WHERE id = ?`, args: [JSON.stringify(Array.from(new Set([...had, ...s.sports]))), athleteId] });
  }
  if (picks.genre && s.genre) stmts.push({ sql: `UPDATE users SET gender = ? WHERE id = ?`, args: [s.genre, athleteId] });
  for (const i of picks.mesures) {
    const m = s.mesures[i];
    if (m) stmts.push({ sql: `INSERT INTO athlete_measurements (id, athlete_id, metric, value, recorded_at, note) VALUES (?, ?, ?, ?, ?, ?)`, args: [randomUUID(), athleteId, m.metric, m.value, day, "Entretien"] });
  }
  for (const i of picks.charges) {
    const c = s.charges[i];
    if (!c) continue;
    const timed = c.kg == null && c.secondes != null;
    stmts.push({
      sql: `INSERT INTO exercise_maxes (id, athlete_id, exercise_name, value_kg, value_type, tested_at, note, reps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), athleteId, c.exercice, timed ? (c.secondes as number) : (c.kg as number), timed ? "temps" : "charge", day, "Entretien", timed ? null : c.reps ?? 1],
    });
  }
  for (const i of picks.antecedents) {
    const a = s.antecedents[i];
    if (!a) continue;
    const start = fullDate(a.date_debut) ?? day;
    // Un antécédent est terminé : sans date de fin, on le clôt à son début.
    const end = fullDate(a.date_fin) ?? start;
    stmts.push({
      sql: `INSERT INTO injuries (id, athlete_id, zone, description, date_start, date_end, advice, category, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'blessure', ?)`,
      args: [randomUUID(), athleteId, a.zone, a.description ?? null, start, end, a.a_surveiller ?? null, user.id],
    });
  }
  stmts.push({ sql: `UPDATE interviews SET applied_at = datetime('now') WHERE id = ?`, args: [id] });
  await dbBatch(stmts);
  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath("/athlete/profile");
}
