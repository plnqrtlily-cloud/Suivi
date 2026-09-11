import { logoutAction } from "@/lib/actions";
import { User } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { getUserAvatar } from "@/lib/queries";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./avatar";
import Link from "next/link";

export async function Nav({ user }: { user: User }) {
  const homeHref = user.role === "coach" ? "/coach" : "/athlete";
  const notifications = await getNotifications(user.id);
  const avatar = user.role === "athlete" ? await getUserAvatar(user.id) : undefined;
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href={homeHref} className="font-display text-lg text-ink">
          Suivi
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href={homeHref} className="text-ink-soft hover:text-ink">
            {user.role === "coach" ? "Mes athlètes" : "Mon calendrier"}
          </Link>
          {user.role === "coach" && (
            <Link href="/coach/resources" className="text-ink-soft hover:text-ink">
              Bibliothèque
            </Link>
          )}
          {user.role === "athlete" && (
            <Link href="/athlete/profile" className="text-ink-soft hover:text-ink">
              Mon profil
            </Link>
          )}
          <Link href="/settings" className="text-ink-soft hover:text-ink">
            Paramètres
          </Link>
          <NotificationBell notifications={notifications} />
          <span className="flex items-center gap-2 text-ink-soft">
            {user.role === "athlete" && (
              <Avatar userId={user.id} firstName={user.first_name} hasAvatar={!!avatar?.avatar_path} size="sm" />
            )}
            {user.first_name} · <span className="text-slate">{user.role === "coach" ? "coach" : "athlète"}</span>
          </span>
          <form action={logoutAction}>
            <button className="text-slate hover:text-ink" type="submit">
              Déconnexion
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
