import { dbAll, dbGet } from "./db";
import { computePlanStatus } from "./billing";

// Règles de suspension, partagées par src/proxy.ts (navigations) et par les
// actions de connexion/inscription : la redirection d'une server action est
// rendue dans la même réponse, sans repasser par le proxy.

/** Coach : bloqué quand l'essai est terminé sans abonnement. */
export async function isCoachBlocked(userId: string): Promise<boolean> {
  const c = await dbGet<{ plan: string; created_at: string; email: string }>(
    `SELECT plan, created_at, email FROM users WHERE id = ?`,
    [userId]
  );
  return !!c && !computePlanStatus(c.plan, c.created_at, c.email).hasAccess;
}

/**
 * Athlète : suspendu quand aucun de ses coachs n'a d'accès. Un athlète sans
 * coach garde l'accès, pour pouvoir en rejoindre un depuis ses Paramètres.
 */
export async function isAthleteSuspended(userId: string): Promise<boolean> {
  const coaches = await dbAll<{ plan: string; created_at: string; email: string }>(
    `SELECT c.plan, c.created_at, c.email FROM coach_athlete_links l
     JOIN users c ON c.id = l.coach_id
     WHERE l.athlete_id = ? AND l.status = 'active'`,
    [userId]
  );
  return coaches.length > 0 && !coaches.some((c) => computePlanStatus(c.plan, c.created_at, c.email).hasAccess);
}

/** Page d'arrivée après connexion ou inscription, suspension comprise. */
export async function homePathFor(user: { id: string; role: string }): Promise<string> {
  if (user.role === "coach") return (await isCoachBlocked(user.id)) ? "/tarifs?essai=termine" : "/coach/dashboard";
  return (await isAthleteSuspended(user.id)) ? "/suspendu" : "/athlete";
}
