import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCoachPlanStatus } from "@/lib/queries";
import { isStripeConfigured } from "@/lib/stripe";
import { createCheckoutSessionAction, createBillingPortalSessionAction } from "@/lib/actions";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card, LinkButton, Button } from "@/components/ui";
import { FREE_PLAN_ATHLETE_LIMIT, FREE_PLAN_TEAM_LIMIT, PRO_PLAN_PRICE_EUR, TRIAL_DURATION_DAYS, upgradeMailtoHref } from "@/lib/billing";

export default async function TarifsPage() {
  const user = await getCurrentUser();
  // Le paiement en self-service n'a de sens que connecté (Stripe a besoin de
  // savoir quel compte faire passer Pro) et déjà pas Pro (sinon on créerait un
  // second abonnement pour le même coach) — sinon on retombe sur le contact
  // par email, comme avant l'intégration Stripe.
  const planStatus = user?.role === "coach" ? await getCoachPlanStatus(user.id) : null;
  const canCheckout = user?.role === "coach" && isStripeConfigured() && planStatus?.plan !== "pro";
  const alreadyPro = planStatus?.plan === "pro";

  const content = (
    <>
      <h1 className="mb-2 font-display text-3xl text-ink">Tarifs</h1>
      <p className="mb-8 text-slate">
        Suivez vos premiers athlètes gratuitement. Passez au plan Pro quand votre effectif grandit — pas de
        facturation automatique pour l&apos;instant, on en discute directement par email.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Gratuit</h2>
          <p className="mb-4 font-display text-3xl text-ink">0€</p>
          <ul className="mb-6 flex flex-col gap-2 text-sm text-ink-soft">
            <li>Jusqu&apos;à {FREE_PLAN_ATHLETE_LIMIT} athlètes en coaching individuel</li>
            <li>Ou {FREE_PLAN_TEAM_LIMIT} équipe de sport collectif, effectif illimité</li>
            <li>Programmation, suivi de forme, messagerie</li>
            <li>Bilans, périodisation, statistiques de performance</li>
            <li>Terrain par poste (foot, rugby, hand, basket)</li>
            <li>{TRIAL_DURATION_DAYS} jours d&apos;essai pour prendre l&apos;app en main</li>
          </ul>
          <LinkButton href="/register" variant="secondary">
            Commencer gratuitement
          </LinkButton>
        </Card>

        <Card className="rounded-3xl border-2 border-moss/40">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-moss-dark">Pro</h2>
          <p className="mb-4 font-display text-3xl text-ink">
            {PRO_PLAN_PRICE_EUR}€<span className="text-base font-normal text-slate">/mois</span>
          </p>
          <ul className="mb-6 flex flex-col gap-2 text-sm text-ink-soft">
            <li>Athlètes et équipes illimités</li>
            <li>Toutes les fonctionnalités de l&apos;offre gratuite</li>
            <li>Support prioritaire par email</li>
          </ul>
          {alreadyPro ? (
            <>
              <p className="mb-3 text-sm font-medium text-moss-dark">Vous êtes déjà au plan Pro.</p>
              {isStripeConfigured() && (
                <form action={createBillingPortalSessionAction}>
                  <Button type="submit" variant="secondary">
                    Gérer mon abonnement
                  </Button>
                </form>
              )}
            </>
          ) : canCheckout ? (
            <form action={createCheckoutSessionAction}>
              <Button type="submit" variant="primary">
                Passer au plan Pro
              </Button>
            </form>
          ) : (
            <LinkButton href={upgradeMailtoHref()} variant="primary">
              Passer au plan Pro
            </LinkButton>
          )}
        </Card>
      </div>

      <p className="mt-6 text-sm text-slate">
        Chaque inscription inclut automatiquement {TRIAL_DURATION_DAYS} jours pour programmer librement et prendre
        l&apos;app en main, sans carte bancaire. Passé ce délai, l&apos;offre gratuite reste active
        (effectif, suivi, statistiques) mais il faut passer au plan Pro pour continuer à programmer de nouvelles
        séances.
      </p>

      <p className="mt-8 text-sm text-slate">
        Une question sur les tarifs, ou un besoin particulier (plusieurs coachs, une structure) ?{" "}
        <a href={upgradeMailtoHref()} className="font-semibold text-moss-dark hover:underline">
          Écrivez-nous
        </a>
        .
      </p>
    </>
  );

  if (user?.role === "coach") {
    return (
      <div className="flex min-h-screen bg-paper">
        <CoachSidebar user={user} activeHref="/tarifs" />
        <div className="min-w-0 flex-1">
          <div className="lg:hidden">
            <Nav user={user} />
          </div>
          <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8">{content}</main>
        </div>
      </div>
    );
  }

  // Visiteur non connecté (ex. lien du teaser envoyé aux clubs démarchés) —
  // même en-tête minimal que les pages publiques login/register plutôt qu'une
  // page nue sans identité ni moyen de revenir au reste de l'app.
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="font-display text-xl text-ink">
          Rythme
        </Link>
        <Link href="/login" className="text-sm font-medium text-moss-dark hover:underline">
          Se connecter
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-12 sm:px-6">{content}</main>
    </div>
  );
}
