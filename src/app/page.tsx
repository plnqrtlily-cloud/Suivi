import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LinkButton } from "@/components/ui";

const FEATURES = [
  { title: "Programmation", text: "Séances, blocs et cycles : planifiez la saison et ajustez semaine après semaine." },
  { title: "Suivi de forme", text: "Sommeil, fatigue, douleurs : l'athlète renseigne sa forme, vous adaptez la charge." },
  { title: "Santé", text: "Blessures et maladies signalées par l'athlète, avec un fil d'échange dédié." },
  { title: "Messagerie", text: "Échangez avec chaque athlète, photos et vidéos comprises." },
  { title: "Tests et zones", text: "Tests à l'effort, zones FC, puissance et allure calculées automatiquement." },
  { title: "Calendrier", text: "Synchronisé avec Google, Apple ou Outlook pour l'athlète." },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "coach" ? "/coach/dashboard" : "/athlete");

  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="font-display text-xl text-ink">Rythme</span>
        <nav className="flex items-center gap-5">
          <Link href="/tarifs" className="text-sm font-medium text-slate hover:text-ink">
            Tarifs
          </Link>
          <Link href="/login" className="text-sm font-medium text-moss-dark hover:underline">
            Se connecter
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-20 px-4 pb-24 sm:px-6">
        {/* Hero */}
        <section className="flex flex-col items-start gap-5 pt-6">
          <span className="w-fit rounded-full bg-moss/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss-dark">
            Coaching individuel
          </span>
          <h1 className="max-w-2xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            Le suivi d&apos;entraînement pensé pour le coach et l&apos;athlète.
          </h1>
          <p className="max-w-xl text-lg text-slate">
            Programmez les séances, suivez la forme au jour le jour et échangez avec chaque athlète, au même endroit.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/register" variant="primary">
              Créer mon compte coach
            </LinkButton>
            <LinkButton href="/tarifs" variant="secondary">
              Voir les tarifs
            </LinkButton>
          </div>
          <p className="text-sm text-slate">3 mois d&apos;essai gratuit, sans carte bancaire.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border border-line bg-white p-6">
              <h2 className="mb-2 font-display text-xl text-ink">{f.title}</h2>
              <p className="text-sm text-slate">{f.text}</p>
            </div>
          ))}
        </section>

        {/* CTA final */}
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white px-6 py-12 text-center">
          <h2 className="font-display text-2xl text-ink">Prêt à essayer ?</h2>
          <p className="max-w-md text-slate">
            3 mois d&apos;essai gratuit, athlètes illimités, sans carte bancaire.
          </p>
          <LinkButton href="/register" variant="primary">
            Créer mon compte coach
          </LinkButton>
        </section>
      </main>
    </div>
  );
}
