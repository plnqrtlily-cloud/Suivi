import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { LogoutAllButton, DeleteAccountButton } from "./account-buttons";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-8 font-display text-3xl text-ink">Paramètres du compte</h1>

        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Exporter mes données (RGPD)</h2>
          <p className="mb-3 text-sm text-slate">
            Téléchargez l&apos;ensemble de vos données à tout moment, sans avoir à en faire la demande.
          </p>
          <div className="flex gap-3">
            <a href="/api/export?format=json" className="rounded-md border border-line px-4 py-2 text-sm hover:border-moss">
              Export complet (JSON)
            </a>
            <a href="/api/export?format=summary" className="rounded-md border border-line px-4 py-2 text-sm hover:border-moss">
              Résumé lisible (.txt)
            </a>
          </div>
        </Card>

        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Sécurité</h2>
          <p className="mb-3 text-sm text-slate">
            Si vous pensez que votre compte a pu être consulté par quelqu&apos;un d&apos;autre, déconnectez tous les
            appareils : chaque session active devra se reconnecter.
          </p>
          <LogoutAllButton />
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Supprimer mon compte</h2>
          <p className="mb-3 text-sm text-slate">
            Action définitive. {user.role === "athlete" && "Vos coachs perdront l'accès à vos données, qui seront intégralement effacées."}
          </p>
          <DeleteAccountButton />
        </Card>
      </main>
    </div>
  );
}
