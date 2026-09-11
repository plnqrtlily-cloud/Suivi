import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCoachesForAthlete, getUnreadMessageCount } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";

export default async function AthleteMessagesIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  const coaches = await getCoachesForAthlete(user.id);
  const unreadByCoach = await Promise.all(
    coaches.map((c) => getUnreadMessageCount(c.coach_id, user.id, user.id))
  );

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Messages</h1>
        <p className="mb-6 text-slate">Discutez directement avec vos coachs.</p>

        {coaches.length === 0 ? (
          <Card className="rounded-3xl">
            <p className="text-sm text-slate">
              Aucun coach lié pour l&apos;instant — rejoignez un coach depuis votre page d&apos;accueil pour pouvoir lui écrire.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {coaches.map((c, i) => {
              const unread = unreadByCoach[i];
              return (
                <li key={c.link_id}>
                  <Link
                    href={`/athlete/messages/${c.coach_id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-moss"
                  >
                    <Avatar userId={c.coach_id} firstName={c.first_name} hasAvatar={false} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="truncate text-xs text-slate">{c.email}</p>
                    </div>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-moss px-1.5 text-xs font-medium text-white">
                        {unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
