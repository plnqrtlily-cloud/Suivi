import Link from "next/link";
import { Card } from "@/components/ui";
import { FREE_PLAN_ATHLETE_LIMIT, PRO_PLAN_PRICE_EUR, TRIAL_DURATION_DAYS, upgradeMailtoHref } from "@/lib/billing";

export default function TarifsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
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
            <li>Jusqu&apos;à {FREE_PLAN_ATHLETE_LIMIT} athlètes</li>
            <li>Programmation, suivi de forme, messagerie</li>
            <li>Bilans, périodisation, statistiques de performance</li>
            <li>Équipes de sport collectif — terrain par poste (foot, rugby, hand, basket)</li>
          </ul>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:border-moss"
          >
            Commencer gratuitement
          </Link>
        </Card>

        <Card className="rounded-3xl border-2 border-moss/40">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-moss-dark">Pro</h2>
          <p className="mb-4 font-display text-3xl text-ink">
            {PRO_PLAN_PRICE_EUR}€<span className="text-base font-normal text-slate">/mois</span>
          </p>
          <ul className="mb-6 flex flex-col gap-2 text-sm text-ink-soft">
            <li>Athlètes illimités</li>
            <li>Toutes les fonctionnalités de l&apos;offre gratuite</li>
            <li>Support prioritaire par email</li>
          </ul>
          <a
            href={upgradeMailtoHref()}
            className="inline-flex items-center justify-center rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-moss-dark"
          >
            Passer au plan Pro
          </a>
        </Card>
      </div>

      <p className="mt-6 text-sm text-slate">
        Envie de tester le plan Pro avant de vous décider ? {TRIAL_DURATION_DAYS} jours d&apos;essai gratuit, sans
        carte bancaire, activables depuis votre tableau de bord.
      </p>

      <p className="mt-8 text-sm text-slate">
        Une question sur les tarifs, ou un besoin particulier (plusieurs coachs, une structure) ?{" "}
        <a href={upgradeMailtoHref()} className="font-semibold text-moss-dark hover:underline">
          Écrivez-nous
        </a>
        .
      </p>
    </main>
  );
}
