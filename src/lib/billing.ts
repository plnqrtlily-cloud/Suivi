// Offre commerciale : pas de facturation automatisée pour l'instant (aucun
// compte Stripe branché) — un coach qui veut dépasser l'offre gratuite
// contacte directement l'éditeur, qui bascule son compte en 'pro' à la main
// (cf. plan sur users, colonne ajoutée dans src/lib/db.ts). Centraliser ces
// constantes ici évite de disperser le prix et la limite dans chaque écran
// qui les affiche.
export const FREE_PLAN_ATHLETE_LIMIT = 3;
export const PRO_PLAN_PRICE_EUR = 19;
export const UPGRADE_CONTACT_EMAIL = "plnqrtlily@gmail.com";

export function upgradeMailtoHref(context?: string): string {
  const subject = encodeURIComponent("Passer au plan Pro — Rythme");
  const body = encodeURIComponent(
    `Bonjour,\n\nJe souhaite passer au plan Pro (${PRO_PLAN_PRICE_EUR}€/mois, athlètes illimités).${
      context ? `\n\n${context}` : ""
    }\n\nMon adresse de connexion : \n\nMerci !`
  );
  return `mailto:${UPGRADE_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}
