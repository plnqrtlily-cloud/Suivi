import { Card } from "@/components/ui";

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <h1 className="mb-2 font-display text-3xl text-ink">Conditions d&apos;utilisation &amp; confidentialité</h1>
      <p className="mb-8 text-sm text-clay">
        ⚠️ Ceci est un squelette de prototype, pas un document juridique valide. À faire rédiger et valider par un
        professionnel du droit avant toute ouverture publique du service (cf. section « Aspects légaux » du prompt produit).
      </p>

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-ink-soft">Données collectées</h2>
        <p className="text-sm text-ink">
          Identité (nom, email), et sur autorisation explicite de l&apos;athlète : mesures physiologiques, antécédents de
          blessures, journal de bord, et cycle menstruel. Ces dernières relèvent de la catégorie « données de santé »
          au sens de l&apos;article 9 du RGPD et font l&apos;objet d&apos;un consentement distinct de celui des présentes
          conditions (voir le réglage de partage dans le profil athlète).
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-ink-soft">Vos droits</h2>
        <p className="text-sm text-ink">
          Vous pouvez à tout moment exporter l&apos;intégralité de vos données (page « Paramètres du compte ») ou
          demander la suppression complète de votre compte, effective immédiatement.
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-ink-soft">Cookies</h2>
        <p className="text-sm text-ink">
          Ce prototype n&apos;utilise qu&apos;un cookie de session strictement nécessaire à la connexion (aucun
          cookie de mesure d&apos;audience ou publicitaire) — un tel cookie ne nécessite pas de bandeau de consentement
          au sens des recommandations de la CNIL. Un bandeau devra être ajouté si un outil d&apos;analytics ou de
          suivi d&apos;erreurs (ex. Sentry côté navigateur) est introduit plus tard.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-medium text-ink-soft">Propriété du compte</h2>
        <p className="text-sm text-ink">
          Le compte d&apos;un·e athlète et son historique lui appartiennent : ils restent accessibles même si
          l&apos;abonnement de son coach venait à expirer.
        </p>
      </Card>
    </main>
  );
}
