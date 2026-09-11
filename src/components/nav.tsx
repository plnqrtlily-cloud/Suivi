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
  const links = (
    <>
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
    </>
  );
  const userInfo = (
    <span className="flex items-center gap-2 text-ink-soft">
      {user.role === "athlete" && (
        <Avatar userId={user.id} firstName={user.first_name} hasAvatar={!!avatar?.avatar_path} size="sm" />
      )}
      {user.first_name} · <span className="text-slate">{user.role === "coach" ? "coach" : "athlète"}</span>
    </span>
  );
  return (
    <header className="border-b border-line bg-white">
      <input type="checkbox" id="nav-toggle" className="peer hidden" />
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href={homeHref} className="shrink-0 font-display text-lg text-ink">
          Suivi
        </Link>
        <nav className="hidden items-center gap-6 text-sm sm:flex">
          {links}
          <NotificationBell notifications={notifications} />
          {userInfo}
          <form action={logoutAction}>
            <button className="text-slate hover:text-ink" type="submit">
              Déconnexion
            </button>
          </form>
        </nav>
        <div className="flex items-center gap-3 sm:hidden">
          <NotificationBell notifications={notifications} />
          <label
            htmlFor="nav-toggle"
            className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-lg leading-none text-ink"
            aria-label="Ouvrir le menu"
          >
            ☰
          </label>
        </div>
      </div>
      <div className="hidden flex-col gap-4 border-t border-line bg-white px-4 py-4 text-sm max-sm:peer-checked:flex">
        {links}
        {userInfo}
        <form action={logoutAction}>
          <button className="text-slate hover:text-ink" type="submit">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
