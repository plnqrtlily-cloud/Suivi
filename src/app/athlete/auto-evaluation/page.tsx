import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPerformanceProfile } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { SelfEvaluation } from "./self-evaluation";

export default async function SelfEvaluationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");
  const profile = await getPerformanceProfile(user.id);

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/athlete/profile" className="text-sm font-semibold text-moss-dark hover:underline">
          ← Mon profil
        </Link>
        <h1 className="mb-1 mt-3 font-display text-3xl text-ink">Mon auto-évaluation</h1>
        <p className="mb-8 max-w-[560px] text-slate">
          Note-toi de 1 à 5 sur chaque qualité, telle que tu te vois aujourd’hui. Ton coach compare ta vision à la sienne pour mieux cibler l’entraînement : il n’y a pas de bonne ou
          de mauvaise réponse.
        </p>
        {profile.qualities.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate">Ton coach n’a pas encore préparé ton profil de performance.</p>
        ) : (
          <SelfEvaluation qualities={profile.qualities.map((q) => ({ id: q.id, domain: q.domain, name: q.name, level: q.athlete_level ?? 0 }))} lastDate={profile.selfEvalDate} />
        )}
      </main>
    </div>
  );
}
