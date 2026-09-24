import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { TeamPitch } from "@/components/team-pitch";
import { LinkButton } from "@/components/ui";
import { TEAM_SPORTS, type TeamSport } from "@/lib/team-sports";

// Effectif fictif, uniquement pour montrer le principe de placement par poste
// à un visiteur non connecté — cf. TeamPitch (interactive=false : pas de lien
// vers une fiche athlète qui n'existe pas ici).
const DEMO_MEMBERS = [
  { athleteId: "demo-1", firstName: "Gardien", avatarPath: null, position: "gardien" },
  { athleteId: "demo-2", firstName: "Défenseur", avatarPath: null, position: "defenseur" },
  { athleteId: "demo-3", firstName: "Défenseur", avatarPath: null, position: "defenseur" },
  { athleteId: "demo-4", firstName: "Milieu", avatarPath: null, position: "milieu" },
  { athleteId: "demo-5", firstName: "Attaquant", avatarPath: null, position: "attaquant" },
];

const SPORT_CARDS: { sport: TeamSport; positions: string }[] = [
  { sport: "football", positions: "Gardien · Défenseur · Milieu · Attaquant" },
  { sport: "rugby", positions: "Avant · Demi · Trois-quarts · Arrière" },
  { sport: "handball", positions: "Gardien · Arrière · Ailier · Pivot" },
  { sport: "basketball", positions: "Meneur · Arrière · Ailier · Ailier fort · Pivot" },
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
        <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-5">
            <span className="w-fit rounded-full bg-moss/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss-dark">
              Coaching individuel &amp; sport collectif
            </span>
            <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
              Le suivi d&apos;entraînement pensé pour les deux.
            </h1>
            <p className="max-w-md text-lg text-slate">
              Programmez les séances, suivez la forme au jour le jour et visualisez votre effectif — un athlète seul
              ou une équipe complète positionnée sur le terrain selon son poste.
            </p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/register" variant="primary">
                Créer mon compte coach
              </LinkButton>
              <LinkButton href="/tarifs" variant="secondary">
                Voir les tarifs
              </LinkButton>
            </div>
            <p className="text-sm text-slate">Gratuit pour commencer, sans carte bancaire.</p>
          </div>
          <div className="flex flex-col gap-2">
            <TeamPitch sport="football" members={DEMO_MEMBERS} interactive={false} />
            <p className="text-center text-xs text-slate">
              Effectif positionné automatiquement selon le poste de chaque joueur.
            </p>
          </div>
        </section>

        {/* Deux facettes */}
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-line bg-white p-6">
            <h2 className="mb-2 font-display text-xl text-ink">Coaching individuel</h2>
            <p className="mb-4 text-sm text-slate">
              Course, vélo, natation, musculation, randonnée, escalade... programmez les séances, suivez la forme et
              la charge d&apos;entraînement, planifiez la saison par blocs et cycles.
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
              <li>Calendrier et bilans d&apos;entraînement</li>
              <li>Suivi de forme quotidien, messagerie intégrée</li>
              <li>Périodisation par saison, bloc et cycle</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-line bg-white p-6">
            <h2 className="mb-2 font-display text-xl text-ink">Sport collectif</h2>
            <p className="mb-4 text-sm text-slate">
              Créez une équipe, renseignez le poste de chaque joueur et retrouvez votre effectif positionné sur un
              terrain — plus une simple liste de noms.
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
              <li>Vision de terrain par poste, 4 sports</li>
              <li>Une séance programmée pour toute l&apos;équipe en un clic</li>
              <li>Équipe et poste visibles sur la fiche de chaque joueur</li>
            </ul>
          </div>
        </section>

        {/* 4 sports */}
        <section>
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <h2 className="font-display text-2xl text-ink">4 sports collectifs, un référentiel de postes pour chacun</h2>
            <p className="max-w-lg text-slate">
              Plusieurs équipes nommées par coach, chacune avec son sport et son effectif propre.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {SPORT_CARDS.map(({ sport, positions }) => (
              <div key={sport} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white p-4">
                <div className="w-full">
                  <TeamPitch sport={sport} members={[]} interactive={false} />
                </div>
                <h3 className="text-sm font-semibold text-ink">{TEAM_SPORTS[sport].label}</h3>
                <p className="text-center text-xs text-slate">{positions}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white px-6 py-12 text-center">
          <h2 className="font-display text-2xl text-ink">Prêt à essayer ?</h2>
          <p className="max-w-md text-slate">
            Gratuit pour une équipe complète ou jusqu&apos;à 3 athlètes en coaching individuel, sans carte bancaire.
          </p>
          <LinkButton href="/register" variant="primary">
            Créer mon compte coach
          </LinkButton>
        </section>
      </main>
    </div>
  );
}
