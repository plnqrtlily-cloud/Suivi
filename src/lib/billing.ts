// Offre commerciale : 3 mois d'essai complet, puis abonnement Pro. Le paiement
// passe par Stripe quand il est configuré (cf. src/lib/stripe.ts), sinon par
// email : l'éditeur bascule alors le compte en 'pro' à la main (cf. /admin).
// Centraliser ces constantes ici évite de disperser le prix et la durée
// d'essai dans chaque écran qui les affiche.
export const PRO_PLAN_PRICE_EUR = 19;
export const UPGRADE_CONTACT_EMAIL = "plnqrtlily@gmail.com";
// Essai gratuit de 3 mois, sans limite (athlètes et équipes illimités, toutes
// les fonctions) : il démarre à l'inscription. Au-delà, l'espace coach est
// bloqué jusqu'au paiement — il n'y a plus d'offre gratuite permanente.
export const TRIAL_DURATION_MONTHS = 3;
// Passage à ce modèle : les coachs inscrits avant cette date ont droit à
// leurs 3 mois complets à partir d'elle, plutôt que depuis leur inscription
// (sinon les plus anciens seraient bloqués du jour au lendemain).
export const TRIAL_POLICY_START = "2026-10-01";
// Contrôle d'accès à /admin — même valeur que UPGRADE_CONTACT_EMAIL aujourd'hui,
// mais un rôle différent (identifiant d'accès plutôt qu'adresse affichée aux
// utilisateurs) : gardées séparées pour ne pas les faire dépendre l'une de
// l'autre si l'une change un jour sans l'autre.
export const ADMIN_EMAIL = "plnqrtlily@gmail.com";

export interface PlanStatus {
  plan: string; // valeur brute de la colonne : 'free' | 'pro'
  isPro: boolean; // abonnement payé
  trialEndsAt: string | null; // fin de l'essai (AAAA-MM-JJ) ; null si Pro
  trialDaysLeft: number | null; // jours d'essai restants ; null si Pro ou essai terminé
  hasAccess: boolean; // Pro, ou essai en cours : sinon l'espace coach est bloqué
}

/** Fin de l'essai : 3 mois après l'inscription, ou après TRIAL_POLICY_START pour les comptes plus anciens. */
export function trialEndDate(createdAt: string): Date {
  const signup = new Date(createdAt.replace(" ", "T").slice(0, 10) + "T00:00:00Z");
  const policy = new Date(`${TRIAL_POLICY_START}T00:00:00Z`);
  const start = signup > policy ? signup : policy;
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + TRIAL_DURATION_MONTHS);
  return end;
}

/**
 * L'état effectif se recalcule à chaque lecture à partir de la date de
 * création du compte, comme l'expiration des sessions dans getCurrentUser
 * (pas de tâche planifiée). L'administratrice garde toujours l'accès.
 */
export function computePlanStatus(plan: string, createdAt: string, email?: string, now: Date = new Date()): PlanStatus {
  if (plan === "pro" || (email && email.toLowerCase() === ADMIN_EMAIL)) {
    return { plan, isPro: plan === "pro", trialEndsAt: null, trialDaysLeft: null, hasAccess: true };
  }
  const end = trialEndDate(createdAt);
  const msLeft = end.getTime() - now.getTime();
  const trialActive = msLeft > 0;
  return {
    plan,
    isPro: false,
    trialEndsAt: end.toISOString().slice(0, 10),
    trialDaysLeft: trialActive ? Math.ceil(msLeft / 86400000) : null,
    hasAccess: trialActive,
  };
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 1er janvier 2027 » à partir de AAAA-MM-JJ. */
export function formatTrialDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

export function upgradeMailtoHref(context?: string): string {
  const subject = encodeURIComponent("Passer au plan Pro — Rythme");
  const body = encodeURIComponent(
    `Bonjour,\n\nJe souhaite passer au plan Pro (${PRO_PLAN_PRICE_EUR}€/mois).${
      context ? `\n\n${context}` : ""
    }\n\nMon adresse de connexion : \n\nMerci !`
  );
  return `mailto:${UPGRADE_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}
