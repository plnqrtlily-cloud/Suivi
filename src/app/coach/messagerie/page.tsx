import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAthletesForCoach, getMessages, getUnreadMessageCount } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";
import { BroadcastMessageModal } from "../broadcast-message-modal";

// Toutes les conversations au même endroit, plutôt que d'ouvrir la fiche de
// chaque athlète pour lire ses messages.
export default async function CoachMessageriePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const links = await getAthletesForCoach(user.id);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);

  const conversations = await Promise.all(
    activeAthletes.map(async (l) => {
      const athleteId = l.athlete_id as string;
      const [messages, unread] = await Promise.all([
        getMessages(user.id, athleteId, 1),
        getUnreadMessageCount(user.id, athleteId, user.id),
      ]);
      // getMessages renvoie par ordre croissant : le dernier élément est le
      // message le plus récent.
      const last = (messages as any[])[messages.length - 1];
      return { athleteId, link: l, last, unread };
    })
  );

  // Les conversations non lues d'abord, puis les plus récentes.
  conversations.sort((a, b) => {
    if (a.unread !== b.unread) return b.unread - a.unread;
    const da = a.last?.created_at ?? "";
    const db = b.last?.created_at ?? "";
    return db.localeCompare(da);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/messagerie" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-3xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="mb-1 font-display text-3xl text-ink">Messagerie</h1>
              <p className="text-slate">
                {totalUnread > 0
                  ? `${totalUnread} message${totalUnread > 1 ? "s" : ""} non lu${totalUnread > 1 ? "s" : ""}`
                  : "Tout est lu"}
              </p>
            </div>
            {activeAthletes.length > 0 && <BroadcastMessageModal athleteCount={activeAthletes.length} />}
          </div>

          {activeAthletes.length === 0 ? (
            <Card className="rounded-3xl">
              <p className="text-slate">Aucun athlète actif pour l&apos;instant.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((c) => (
                <Link
                  key={c.athleteId}
                  href={`/coach/athletes/${c.athleteId}/messages`}
                  className={`flex items-center gap-3 rounded-2xl border bg-white p-3 transition-colors hover:border-moss ${
                    c.unread > 0 ? "border-moss/40" : "border-line"
                  }`}
                >
                  <Avatar userId={c.athleteId} firstName={c.link.first_name || "?"} hasAvatar={!!c.link.avatar_path} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${c.unread > 0 ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                      {c.link.first_name} {c.link.last_name}
                    </p>
                    <p className="truncate text-sm text-slate">
                      {c.last ? (
                        <>
                          {c.last.sender_id === user.id && "Vous : "}
                          {c.last.body}
                        </>
                      ) : (
                        <span className="text-xs">Aucun message échangé</span>
                      )}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-moss px-2 py-0.5 text-[11px] font-semibold text-white">
                      {c.unread}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
