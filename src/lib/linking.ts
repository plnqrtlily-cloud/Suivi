// Liaison coach ↔ athlète, dans les deux sens :
// - le coach invite (lien /invite/<code> ou code d'invitation à usage unique) ;
// - l'athlète saisit le code coach permanent de son coach (Moi › Mes coachs).
// Un même point d'entrée sert à l'inscription, à la connexion, à la page
// d'invitation et au formulaire « Rejoindre ».
import { randomUUID } from "crypto";
import { dbGet, dbRun } from "./db";
import { getCoachPlanStatus } from "./queries";
import { createNotification } from "./notifications";

/** Code coach permanent, dérivé de son identifiant (8 caractères). */
export function coachCodeFor(coachId: string) {
  return coachId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Accepte un code seul ou un lien d'invitation collé tel quel. */
export function normalizeLinkCode(raw: string) {
  let s = raw.trim();
  const i = s.indexOf("/invite/");
  if (i >= 0) s = s.slice(i + "/invite/".length);
  s = s.split(/[?#/\s]/)[0] ?? "";
  return s.toLowerCase();
}

type LinkResult = { ok: true; coachName: string; already?: boolean } | { error: string };

async function notifyCoach(coachId: string, athleteId: string) {
  const a = await dbGet<{ first_name: string; last_name: string }>(`SELECT first_name, last_name FROM users WHERE id = ?`, [athleteId]);
  if (!a) return;
  await createNotification({
    userId: coachId,
    type: "message",
    title: `${a.first_name} ${a.last_name} a rejoint ton suivi`,
    link: `/coach/athletes/${athleteId}`,
  }).catch(() => {});
}

export async function linkAthleteWithCode(athleteId: string, rawCode: string): Promise<LinkResult> {
  const code = normalizeLinkCode(rawCode);
  if (!code) return { error: "Saisis le code ou colle le lien d'invitation." };

  // 1. Invitation envoyée par un coach (usage unique).
  const invite = await dbGet<{ id: string; coach_id: string; status: string; first_name: string; last_name: string }>(
    `SELECT l.id, l.coach_id, l.status, u.first_name, u.last_name
     FROM coach_athlete_links l JOIN users u ON u.id = l.coach_id
     WHERE lower(l.invite_token) = ?`,
    [code]
  );
  if (invite) {
    const coachName = `${invite.first_name} ${invite.last_name}`.trim();
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM coach_athlete_links WHERE coach_id = ? AND athlete_id = ? AND status = 'active'`,
      [invite.coach_id, athleteId]
    );
    if (existing) {
      // Déjà lié à ce coach : l'invitation en double est simplement refermée.
      if (invite.status === "pending") await dbRun(`UPDATE coach_athlete_links SET status = 'revoked' WHERE id = ?`, [invite.id]);
      return { ok: true, coachName, already: true };
    }
    if (invite.status !== "pending") return { error: "Cette invitation a déjà été utilisée. Demande un nouveau lien ou le code coach à ton coach." };
    await dbRun(`UPDATE coach_athlete_links SET athlete_id = ?, status = 'active', accepted_at = datetime('now') WHERE id = ?`, [
      athleteId,
      invite.id,
    ]);
    await notifyCoach(invite.coach_id, athleteId);
    return { ok: true, coachName };
  }

  // 2. Code coach permanent.
  if (/^[0-9a-f]{8}$/.test(code)) {
    const coach = await dbGet<{ id: string; first_name: string; last_name: string }>(
      `SELECT id, first_name, last_name FROM users WHERE role = 'coach' AND lower(substr(replace(id, '-', ''), 1, 8)) = ?`,
      [code]
    );
    if (coach) {
      const coachName = `${coach.first_name} ${coach.last_name}`.trim();
      const existing = await dbGet<{ id: string }>(
        `SELECT id FROM coach_athlete_links WHERE coach_id = ? AND athlete_id = ? AND status = 'active'`,
        [coach.id, athleteId]
      );
      if (existing) return { ok: true, coachName, already: true };
      const plan = await getCoachPlanStatus(coach.id);
      if (!plan.hasAccess) return { error: `L'abonnement de ${coachName} ne permet pas d'ajouter d'athlète pour le moment.` };
      await dbRun(
        `INSERT INTO coach_athlete_links (id, coach_id, athlete_id, status, accepted_at) VALUES (?, ?, ?, 'active', datetime('now'))`,
        [randomUUID(), coach.id, athleteId]
      );
      await notifyCoach(coach.id, athleteId);
      return { ok: true, coachName };
    }
  }

  return { error: "Code introuvable. Vérifie-le auprès de ton coach." };
}
