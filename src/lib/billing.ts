// Offre commerciale : pas de facturation automatisée pour l'instant (aucun
// compte Stripe branché) — un coach qui veut dépasser l'offre gratuite
// contacte directement l'éditeur, qui bascule son compte en 'pro' à la main
// (cf. plan sur users, colonne ajoutée dans src/lib/db.ts). Centraliser ces
// constantes ici évite de disperser le prix et la limite dans chaque écran
// qui les affiche.
export const FREE_PLAN_ATHLETE_LIMIT = 3;
// Un coach qui a créé son équipe gratuite (sport collectif) n'est plus
// soumis à FREE_PLAN_ATHLETE_LIMIT : le vrai levier gratuit/payant pour le
// sport co est le nombre d'équipes, pas la taille de l'effectif (un effectif
// de foot dépasse largement 3 joueurs). Cf. createInviteAction/createTeamAction.
export const FREE_PLAN_TEAM_LIMIT = 1;
export const PRO_PLAN_PRICE_EUR = 19;
export const UPGRADE_CONTACT_EMAIL = "plnqrtlily@gmail.com";
// Durée pendant laquelle un compte gratuit peut encore programmer de
// nouvelles séances après son inscription (cf. createWorkoutAction/
// createTeamSessionAction) — assez long pour prendre en main l'app et
// programmer plusieurs semaines réelles, court assez pour donner envie de
// passer Pro. Ne s'applique pas à FREE_PLAN_ATHLETE_LIMIT/FREE_PLAN_TEAM_LIMIT,
// qui restent valables indéfiniment sur l'offre gratuite.
export const TRIAL_DURATION_DAYS = 30;
// Contrôle d'accès à /admin — même valeur que UPGRADE_CONTACT_EMAIL aujourd'hui,
// mais un rôle différent (identifiant d'accès plutôt qu'adresse affichée aux
// utilisateurs) : gardées séparées pour ne pas les faire dépendre l'une de
// l'autre si l'une change un jour sans l'autre.
export const ADMIN_EMAIL = "plnqrtlily@gmail.com";

export interface PlanStatus {
  plan: string; // valeur brute de la colonne : 'free' | 'pro'
  isPro: boolean; // plan payant uniquement — l'essai automatique ne lève plus
  // FREE_PLAN_ATHLETE_LIMIT/FREE_PLAN_TEAM_LIMIT, seulement canCreateSessions.
  trialDaysLeft: number | null; // jours restants avant blocage ; null si Pro ou essai déjà terminé
  canCreateSessions: boolean; // false si free et essai (TRIAL_DURATION_DAYS depuis l'inscription) terminé
}

/**
 * Essai automatique depuis l'inscription (pas d'action manuelle du coach) :
 * l'état effectif se recalcule à chaque lecture à partir de la date de
 * création du compte, comme l'expiration des sessions dans getCurrentUser.
 * Un essai expiré ne bloque que la création de nouvelles séances
 * (createWorkoutAction/createTeamSessionAction) — le reste de l'app (suivi,
 * effectif, statistiques) reste consultable normalement.
 */
export function computePlanStatus(plan: string, createdAt: string): PlanStatus {
  if (plan === "pro") {
    return { plan, isPro: true, trialDaysLeft: null, canCreateSessions: true };
  }
  const daysSince = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const trialActive = daysSince < TRIAL_DURATION_DAYS;
  return {
    plan,
    isPro: false,
    trialDaysLeft: trialActive ? TRIAL_DURATION_DAYS - daysSince : null,
    canCreateSessions: trialActive,
  };
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
