import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPushPublicKey } from "@/lib/push";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { LogoutAllButton, DeleteAccountButton } from "./account-buttons";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";
import Link from "next/link";
import { getCoachesForAthlete, getCalendarToken } from "@/lib/queries";
import { CalendarSyncPanel } from "@/app/athlete/profile/calendar-sync-panel";
import { JoinCoachForm } from "@/app/athlete/join-coach-form";
import { RevokeButton } from "@/app/coach/revoke-button";
import { InviteForm } from "@/app/coach/invite-form";

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

  // Connexions externes et coachs liés : regroupés ici plutôt que sur le profil,
  // qui concerne les données sportives de l'athlète (mesures, zones, blessures).
  const isAthlete = user.role === "athlete";
  // La connexion Garmin / Strava est retirée tant qu'elle n'est pas au point.
  const [coaches, calendarToken] = isAthlete
    ? await Promise.all([getCoachesForAthlete(user.id), getCalendarToken(user.id)])
    : [[], null];

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        {isAthlete && (
          <Link href="/athlete/profile" className="mb-2 inline-flex items-center gap-1 text-[15px] font-semibold text-moss-dark">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5l-5 5 5 5" />
            </svg>
            Moi
          </Link>
        )}
        <h1 className="mb-6 text-[28px] font-bold tracking-tight text-ink">Paramètres</h1>

        <Card className="mb-6 rounded-3xl">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">Notifications push</h2>
          <PushNotificationsToggle publicKey={getPushPublicKey()} />
        </Card>

        {!isAthlete && (
          <Card className="mb-6 rounded-3xl">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Inviter un athlète</h2>
            <InviteForm />
          </Card>
        )}

        {isAthlete && (
          <Card className="mb-6 scroll-mt-4 rounded-3xl" id="coachs">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Mes coachs</h2>
            {coaches.length === 0 && <p className="mb-3 text-sm text-slate">Aucun coach lié pour l&apos;instant.</p>}
            <ul className="mb-4 space-y-2 text-sm">
              {coaches.map((c: any) => (
                <li key={c.link_id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink">
                    {c.first_name} {c.last_name} — {c.email}
                  </span>
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/athlete/messages/${c.coach_id}`}
                      className="flex items-center gap-1 text-xs font-semibold text-moss-dark hover:underline"
                    >
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
                      </svg>
                      Discuter
                    </Link>
                    <RevokeButton linkId={c.link_id} label="Retirer l'accès" />
                  </span>
                </li>
              ))}
            </ul>
            <JoinCoachForm />
          </Card>
        )}

        {/* La synchronisation de calendrier est un réglage de compte, pas une
            donnée sportive : sa place est ici, avec les autres connexions. */}
        {isAthlete && (
          <Card className="mb-6 scroll-mt-4 rounded-3xl" id="calendrier">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Mon calendrier</h2>
            <p className="mb-3 text-xs text-slate">
              Synchronisez vos séances avec Google Agenda, Apple Calendrier ou Outlook.
            </p>
            <CalendarSyncPanel initialToken={calendarToken} />
          </Card>
        )}

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
