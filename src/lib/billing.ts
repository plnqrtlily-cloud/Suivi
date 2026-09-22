// Offre commerciale : pas de facturation automatisée pour l'instant (aucun
// compte Stripe branché) — un coach qui veut dépasser l'offre gratuite
// contacte directement l'éditeur, qui bascule son compte en 'pro' à la main
// (cf. plan sur users, colonne ajoutée dans src/lib/db.ts). Centraliser ces
// constantes ici évite de disperser le prix et la limite dans chaque écran
// qui les affiche.
export const FREE_PLAN_ATHLETE_LIMIT = 3;
export const PRO_PLAN_PRICE_EUR = 19;
export const UPGRADE_CONTACT_EMAIL = "plnqrtlily@gmail.com";
export const TRIAL_DURATION_DAYS = 30;

export interface PlanStatus {
  plan: string; // valeur brute de la colonne : 'free' | 'pro'
  trialStartedAt: string | null;
  isPro: boolean; // effectif : plan Pro payant OU essai encore actif
  trialActive: boolean;
  trialDaysLeft: number | null; // renseigné seulement si trialActive
  trialAvailable: boolean; // jamais démarré, et pas déjà passé Pro
}

/**
 * Pas de tâche planifiée pour désactiver un essai arrivé à terme : l'état
 * effectif se recalcule à chaque lecture à partir de trial_started_at, comme
 * l'expiration des sessions dans getCurrentUser. Un essai expiré retombe de
 * lui-même sur l'offre gratuite, sans rien avoir à réécrire en base.
 */
export function computePlanStatus(plan: string, trialStartedAt: string | null): PlanStatus {
  if (plan === "pro") {
    return { plan, trialStartedAt, isPro: true, trialActive: false, trialDaysLeft: null, trialAvailable: false };
  }
  if (trialStartedAt) {
    const daysSince = Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / 86400000);
    const trialActive = daysSince < TRIAL_DURATION_DAYS;
    return {
      plan,
      trialStartedAt,
      isPro: trialActive,
      trialActive,
      trialDaysLeft: trialActive ? TRIAL_DURATION_DAYS - daysSince : null,
      trialAvailable: false,
    };
  }
  return { plan, trialStartedAt, isPro: false, trialActive: false, trialDaysLeft: null, trialAvailable: true };
}

export function upgradeMailtoHref(context?: string): string {
  const subject = encodeURIComponent("Passer au plan Pro — Rythme");
  const body = encodeURIComponent(
    `Bonjour,\n\nJe souhaite passer au plan Pro (${PRO_PLAN_PRICE_EUR}€/mois, athlètes illimités).${
      context ? `\n\n${context}` : ""
    }\n\nMon adresse de connexion : \n\nMerci !`
  );
  return `mailto:${UPGRADE_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}
