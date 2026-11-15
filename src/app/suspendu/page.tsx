import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCoachesForAthlete } from "@/lib/queries";
import { logoutAction } from "@/lib/actions";

// Athlète dont le coach n'a plus d'abonnement actif (cf. src/proxy.ts) :
// l'app est suspendue, rien n'est perdu, l'accès revient dès le paiement.
export default async function SuspenduPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");
  const coaches = await getCoachesForAthlete(user.id);
  const names = coaches.map((c) => `${c.first_name} ${c.last_name}`.trim()).join(", ") || "ton coach";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f4f3] px-6">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbe3da] text-[#a4492a]">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9V6.5a4 4 0 018 0V9M5 9h10v8H5z" />
          </svg>
        </span>
        <h1 className="text-xl font-bold text-ink">Accès suspendu</h1>
        <p className="text-sm text-ink-soft">
          L&apos;abonnement de <b className="text-ink">{names}</b> n&apos;est plus actif. Ton app revient dès qu&apos;il est réglé : tes séances, ton suivi et tes messages sont conservés.
        </p>
        <p className="text-sm text-slate">N&apos;hésite pas à prévenir ton coach.</p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/settings#coachs" className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-moss-dark">
            Rejoindre un autre coach
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="w-full px-4 py-2 text-sm font-semibold text-slate">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
