import { dbAll, dbGet, dbRun } from "./db";
import { computePlanStatus, trialEndDate } from "./billing";

// Règles de suspension, partagées par src/proxy.ts (navigations) et par les
// actions de connexion/inscription : la redirection d'une server action est
// rendue dans la même réponse, sans repasser par le proxy.
//
// Anti-contournement : l'essai gratuit est aussi compté côté athlète. Un
// athlète ne profite que de 3 mois cumulés auprès de coachs non abonnés, quel
// que soit le nombre de comptes coach : recréer un compte avec une autre
// adresse ne prolonge pas l'accès de ses athlètes. Ce compteur repart de zéro
// dès qu'un coach abonné le suit (cas d'un vrai changement de coach), et
// l'administratrice peut le réinitialiser depuis /admin.

/** Coach : bloqué quand l'essai est terminé sans abonnement. */
export async function isCoachBlocked(userId: string): Promise<boolean> {
  const c = await dbGet<{ plan: string; created_at: string; email: string }>(
    `SELECT plan, created_at, email FROM users WHERE id = ?`,
    [userId]
  );
  return !!c && !computePlanStatus(c.plan, c.created_at, c.email).hasAccess;
}

type CoachRow = { plan: string; created_at: string; email: string };

/** Abonné (ou compte administrateur) : pas de date de fin d'essai. */
function isPaid(c: CoachRow) {
  return computePlanStatus(c.plan, c.created_at, c.email).trialEndsAt === null;
}

/** L'essai cumulé de l'athlète (auprès de coachs non abonnés) est-il épuisé ? */
export function athleteTrialExhausted(trialStart: string | null, now = new Date()) {
  return !!trialStart && trialEndDate(trialStart).getTime() <= now.getTime();
}

/**
 * Athlète : accès si un de ses coachs est abonné, ou si un coach est en essai
 * et que l'athlète n'a pas déjà épuisé ses 3 mois d'essai. Un athlète sans
 * coach garde l'accès, pour pouvoir en rejoindre un depuis ses Paramètres.
 */
export async function isAthleteSuspended(userId: string): Promise<boolean> {
  const coaches = await dbAll<CoachRow>(
    `SELECT c.plan, c.created_at, c.email FROM coach_athlete_links l
     JOIN users c ON c.id = l.coach_id
     WHERE l.athlete_id = ? AND l.status = 'active'`,
    [userId]
  );
  if (!coaches.length) return false;
  const me = await dbGet<{ athlete_trial_start: string | null }>(`SELECT athlete_trial_start FROM users WHERE id = ?`, [userId]);
  const start = me?.athlete_trial_start ?? null;

  if (coaches.some(isPaid)) {
    if (start) await dbRun(`UPDATE users SET athlete_trial_start = NULL WHERE id = ?`, [userId]);
    return false;
  }
  if (!coaches.some((c) => computePlanStatus(c.plan, c.created_at, c.email).hasAccess)) return true;
  if (!start) {
    await startAthleteTrial(userId);
    return false;
  }
  return athleteTrialExhausted(start);
}

/** Démarre le compteur d'essai de l'athlète s'il ne tourne pas déjà. */
export async function startAthleteTrial(athleteId: string) {
  await dbRun(`UPDATE users SET athlete_trial_start = COALESCE(athlete_trial_start, datetime('now')) WHERE id = ?`, [athleteId]);
}

/** Athlètes d'un coach (en essai) dont l'essai est déjà épuisé ailleurs. */
export async function exhaustedAthletesForCoach(coachId: string): Promise<{ id: string; first_name: string; last_name: string }[]> {
  const rows = await dbAll<{ id: string; first_name: string; last_name: string; athlete_trial_start: string | null }>(
    `SELECT u.id, u.first_name, u.last_name, u.athlete_trial_start FROM coach_athlete_links l
     JOIN users u ON u.id = l.athlete_id
     WHERE l.coach_id = ? AND l.status = 'active' AND u.athlete_trial_start IS NOT NULL`,
    [coachId]
  );
  return rows.filter((r) => athleteTrialExhausted(r.athlete_trial_start));
}

/**
 * Forme canonique d'une adresse, pour repérer un même titulaire derrière
 * plusieurs variantes : « +étiquette » ignorée partout, points ignorés chez
 * Gmail (marc.dupont@ = marcdupont@), googlemail.com = gmail.com.
 */
export function canonicalEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  local = local.split("+")[0];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Un compte coach existe-t-il déjà pour une variante de cette adresse ? */
export async function coachEmailTaken(email: string): Promise<boolean> {
  const canon = canonicalEmail(email);
  const coaches = await dbAll<{ email: string }>(`SELECT email FROM users WHERE role = 'coach'`);
  return coaches.some((c) => canonicalEmail(c.email) === canon);
}

/** Page d'arrivée après connexion ou inscription, suspension comprise. */
export async function homePathFor(user: { id: string; role: string }): Promise<string> {
  if (user.role === "coach") return (await isCoachBlocked(user.id)) ? "/tarifs?essai=termine" : "/coach/dashboard";
  return (await isAthleteSuspended(user.id)) ? "/suspendu" : "/athlete";
}
