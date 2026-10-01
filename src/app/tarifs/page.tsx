import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCoachPlanStatus } from "@/lib/queries";
import { isStripeConfigured } from "@/lib/stripe";
import { createCheckoutSessionAction, createBillingPortalSessionAction } from "@/lib/actions";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card, LinkButton, Button } from "@/components/ui";
import { PRO_PLAN_PRICE_EUR, TRIAL_DURATION_MONTHS, formatTrialDate, upgradeMailtoHref } from "@/lib/billing";

export default async function TarifsPage({ searchParams }: { searchParams: Promise<{ essai?: string }> }) {
  const user = await getCurrentUser();
  const { essai } = await searchParams;
  // Le paiement en self-service n'a de sens que connecté (Stripe a besoin de
  // savoir quel compte faire passer Pro) et déjà pas Pro (sinon on créerait un
  // second abonnement pour le même coach) — sinon on retombe sur le contact
  // par email, comme avant l'intégration Stripe.
  const planStatus = user?.role === "coach" ? await getCoachPlanStatus(user.id) : null;
  const canCheckout = user?.role === "coach" && isStripeConfigured() && planStatus?.plan !== "pro";
  const alreadyPro = planStatus?.plan === "pro";
  // Redirigé ici par src/proxy.ts quand l'essai est terminé.
  const trialOver = !!planStatus && !planStatus.hasAccess;
  const endLabel = planStatus?.trialEndsAt ? formatTrialDate(planStatus.trialEndsAt) : null;

  const content = (
    <>
      <h1 className="mb-2 font-display text-3xl text-ink">Tarifs</h1>
      <p className="mb-8 text-slate">
        {TRIAL_DURATION_MONTHS} mois d&apos;essai gratuit, sans limite et sans carte bancaire. Ensuite, un abonnement
        unique pour continuer.
      </p>

      {(trialOver || essai === "termine") && planStatus && !planStatus.hasAccess && (
        <div className="mb-6 rounded-2xl border border-gold-light/40 bg-white p-4 text-sm text-ink">
          <p className="font-semibold">Votre essai gratuit est terminé{endLabel ? ` depuis le ${endLabel}` : ""}.</p>
          <p className="mt-1 text-ink-soft">
            Passez au plan Pro pour retrouver votre espace coach. Vos athlètes, séances et données sont conservés.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Essai gratuit</h2>
          <p className="mb-4 font-display text-3xl text-ink">
            0€<span className="text-base font-normal text-slate"> pendant {TRIAL_DURATION_MONTHS} mois</span>
          </p>
          <ul className="mb-6 flex flex-col gap-2 text-sm text-ink-soft">
            <li>Athlètes et équipes illimités</li>
            <li>Toutes les fonctionnalités, sans restriction</li>
            <li>Sans carte bancaire</li>
          </ul>
          {!user ? (
            <LinkButton href="/register" variant="secondary">
              Commencer l&apos;essai gratuit
            </LinkButton>
          ) : planStatus?.hasAccess && !alreadyPro && endLabel ? (
            <p className="text-sm font-medium text-moss-dark">
              Essai en cours — encore {planStatus.trialDaysLeft} jour{(planStatus.trialDaysLeft ?? 0) > 1 ? "s" : ""}, jusqu&apos;au {endLabel}.
            </p>
          ) : null}
        </Card>

        <Card className="rounded-3xl border-2 border-moss/40">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-moss-dark">Pro</h2>
          <p className="mb-4 font-display text-3xl text-ink">
            {PRO_PLAN_PRICE_EUR}€<span className="text-base font-normal text-slate">/mois</span>
          </p>
          <ul className="mb-6 flex flex-col gap-2 text-sm text-ink-soft">
            <li>Après l&apos;essai : tout continue, sans limite</li>
            <li>Programmation, suivi de forme, messagerie</li>
            <li>Bilans, périodisation, profil de performance</li>
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
        L&apos;essai démarre à l&apos;inscription. Vous pouvez vous abonner avant la fin : le premier paiement n&apos;a
        lieu qu&apos;à la fin des {TRIAL_DURATION_MONTHS} mois. Sans abonnement à la fin de l&apos;essai, l&apos;espace coach est
        suspendu jusqu&apos;au paiement, et vos données sont conservées.
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
