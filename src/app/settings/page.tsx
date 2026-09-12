import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPushPublicKey } from "@/lib/push";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { LogoutAllButton, DeleteAccountButton } from "./account-buttons";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M3 15.5v1a2 2 0 002 2h10a2 2 0 002-2v-1" />
    </svg>
  );
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-8 font-display text-3xl text-ink">Paramètres du compte</h1>

        <Card className="mb-6 rounded-3xl">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">Notifications push</h2>
          <PushNotificationsToggle publicKey={getPushPublicKey()} />
        </Card>

        <Card className="mb-6 rounded-3xl">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">Exporter mes données (RGPD)</h2>
          <p className="mb-3 text-sm text-slate">
            Téléchargez l&apos;ensemble de vos données à tout moment, sans avoir à en faire la demande.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/export?format=json"
              className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-moss hover:text-ink"
            >
              <DownloadIcon />
              Export complet (JSON)
            </a>
            <a
              href="/api/export?format=summary"
              className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-moss hover:text-ink"
            >
              <DownloadIcon />
              Résumé lisible (.txt)
            </a>
          </div>
        </Card>

        <Card className="mb-6 rounded-3xl">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">Sécurité</h2>
          <p className="mb-3 text-sm text-slate">
            Si vous pensez que votre compte a pu être consulté par quelqu&apos;un d&apos;autre, déconnectez tous les
            appareils : chaque session active devra se reconnecter.
          </p>
          <LogoutAllButton />
        </Card>

        <Card className="rounded-3xl">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">Supprimer mon compte</h2>
          <p className="mb-3 text-sm text-slate">
            Action définitive. {user.role === "athlete" && "Vos coachs perdront l'accès à vos données, qui seront intégralement effacées."}
          </p>
          <DeleteAccountButton />
        </Card>
      </main>
    </div>
  );
}
