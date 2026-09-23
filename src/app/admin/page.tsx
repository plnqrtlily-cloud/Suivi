import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllCoaches } from "@/lib/queries";
import { ADMIN_EMAIL, computePlanStatus } from "@/lib/billing";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card } from "@/components/ui";
import { SetPlanButton } from "./set-plan-button";

// Réservée au propriétaire de l'app (comparaison d'email plutôt qu'un
// nouveau rôle en base — cf. plan) : notFound() plutôt qu'une page d'erreur
// explicite, pour ne pas signaler l'existence de la page à qui n'y a pas
// droit, même principe que la garde de permission coach/athlète ailleurs.
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.email !== ADMIN_EMAIL) notFound();

  const coaches = await getAllCoaches();

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/admin" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
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
                  : status.canCreateSessions
                    ? `Essai — ${status.trialDaysLeft} j restants`
                    : "Gratuit (essai terminé)";
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
        </main>
      </div>
    </div>
  );
}
