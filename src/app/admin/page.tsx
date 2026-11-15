import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllCoaches, getAllUsersForAdmin } from "@/lib/queries";
import { ADMIN_EMAIL, computePlanStatus } from "@/lib/billing";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card } from "@/components/ui";
import { SetPlanButton } from "./set-plan-button";
import { athleteTrialExhausted } from "@/lib/access";
import { ResetTrialButton } from "./reset-trial-button";
import { DeleteUserButton } from "./delete-user-button";
import { ensureStripeSetup, isStripeConfigured, type StripeSetup } from "@/lib/stripe";
import { appBaseUrl } from "@/lib/email";

// Réservée au propriétaire de l'app (comparaison d'email plutôt qu'un
// nouveau rôle en base — cf. plan) : notFound() plutôt qu'une page d'erreur
// explicite, pour ne pas signaler l'existence de la page à qui n'y a pas
// droit, même principe que la garde de permission coach/athlète ailleurs.
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.email !== ADMIN_EMAIL) notFound();

  const [coaches, users] = await Promise.all([getAllCoaches(), getAllUsersForAdmin()]);

  // Ouvrir /admin suffit à préparer Stripe (produit, prix, webhook, portail)
  // dès que la clé secrète est en place — avant le premier paiement.
  let stripe: StripeSetup | null = null;
  let stripeError: string | null = null;
  if (isStripeConfigured()) {
    try {
      stripe = await ensureStripeSetup(appBaseUrl());
    } catch (err) {
      stripeError = err instanceof Error ? err.message : "Erreur Stripe.";
    }
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/admin" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <div className="mb-8 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
            <p className="font-medium text-ink">Paiement en ligne (Stripe)</p>
            {!isStripeConfigured() ? (
              <p className="text-slate">Non branché : ajoute STRIPE_SECRET_KEY dans Vercel. En attendant, les coachs s&apos;abonnent par email.</p>
            ) : stripeError ? (
              <p className="text-[#a4492a]">Erreur : {stripeError}</p>
            ) : (
              <p className="text-slate">
                Actif{stripe?.livemode ? "" : " (mode test)"} · produit, prix 19 €/mois et 190 €/an, webhook et portail client prêts.
              </p>
            )}
          </div>

          <h1 className="mb-1 font-display text-3xl text-ink">Coachs</h1>
          <p className="mb-6 text-slate">
            Basculez un coach en Pro une fois son paiement reçu hors application.
          </p>
          <div className="flex flex-col gap-3">
            {coaches.map((c) => {
              const status = computePlanStatus(c.plan, c.created_at);
              const label =
                status.plan === "pro"
                  ? "Pro"
                  : status.hasAccess
                    ? `Essai — ${status.trialDaysLeft} j restants (jusqu'au ${status.trialEndsAt})`
                    : "Essai terminé — accès bloqué";
              return (
                <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl">
                  <div>
                    <p className="font-medium text-ink">
                      {c.first_name} {c.last_name} <span className="text-sm text-slate">({c.email})</span>
                    </p>
                    <p className="text-sm text-slate">
                      {label} · {c.athlete_count} athlète{c.athlete_count > 1 ? "s" : ""} · inscrit le{" "}
                      {c.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <SetPlanButton coachId={c.id} currentPlan={c.plan} />
                </Card>
              );
            })}
            {coaches.length === 0 && <p className="text-slate">Aucun coach pour l&apos;instant.</p>}
          </div>

          <h2 className="mb-1 mt-10 font-display text-2xl text-ink">Tous les comptes</h2>
          <p className="mb-4 text-slate">La suppression est définitive : le compte et toutes ses données sont effacés.</p>
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {users.map((u) => {
              const name = `${u.first_name} ${u.last_name}`.trim();
              const exhausted = u.role === "athlete" && athleteTrialExhausted(u.athlete_trial_start);
              return (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {name} <span className="text-sm text-slate">({u.email})</span>
                    </p>
                    <p className="text-sm text-slate">
                      {u.role === "coach" ? "Coach" : "Athlète"}
                      {u.coach_names ? ` · suivi par ${u.coach_names}` : ""} · inscrit le {u.created_at.slice(0, 10)}
                      {exhausted && <span className="font-medium text-[#a4492a]"> · essai épuisé</span>}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {exhausted && <ResetTrialButton userId={u.id} name={name} />}
                    {u.id !== user.id && <DeleteUserButton userId={u.id} name={name} />}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
