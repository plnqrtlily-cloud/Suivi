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

  const navItems: { href: string; label: string; icon: string }[] = [
    { href: homeHref, icon: "📅", label: user.role === "coach" ? "Mes athlètes" : "Mon calendrier" },
    ...(user.role === "coach" ? [{ href: "/coach/resources", icon: "📚", label: "Bibliothèque" }] : []),
    ...(user.role === "athlete"
      ? [
          { href: "/athlete/profile", icon: "👤", label: "Mon profil" },
          { href: "/athlete/messages", icon: "💬", label: "Messages" },
        ]
      : []),
    { href: "/settings", icon: "⚙️", label: "Paramètres" },
  ];

  const userInfo = (
    <span className="flex items-center gap-2 text-ink-soft">
      {user.role === "athlete" && (
        <Avatar userId={user.id} firstName={user.first_name} hasAvatar={!!avatar?.avatar_path} size="sm" />
      )}
      {user.first_name} · <span className="text-slate">{user.role === "coach" ? "coach" : "athlète"}</span>
    </span>
  );

  return (
    <header className="relative border-b border-line bg-white">
      <input type="checkbox" id="nav-toggle" className="peer hidden" />

      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 lg:px-6">
        <Link href={homeHref} className="shrink-0 font-display text-lg text-ink">
          Suivi
        </Link>

        <nav className="hidden items-center gap-5 text-sm lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap text-ink-soft hover:text-ink">
              {item.label}
            </Link>
          ))}
          <NotificationBell notifications={notifications} />
          {userInfo}
          <form action={logoutAction}>
            <button className="whitespace-nowrap text-slate hover:text-ink" type="submit">
              Déconnexion
            </button>
          </form>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <NotificationBell notifications={notifications} />
          <label
            htmlFor="nav-toggle"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-line text-ink peer-checked:bg-paper-dim"
            aria-label="Ouvrir le menu"
          >
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </label>
        </div>
      </div>

      {/* Fond assombri derrière le menu mobile — cliquer dessus le referme (label pointant vers la même checkbox). */}
      <label
        htmlFor="nav-toggle"
        aria-hidden="true"
        className="fixed inset-0 z-40 hidden bg-ink/25 max-lg:peer-checked:block lg:hidden"
      />

      <div className="absolute inset-x-3 top-full z-50 hidden flex-col overflow-hidden rounded-xl border border-line bg-white shadow-lg max-lg:peer-checked:flex lg:hidden">
        <nav className="flex flex-col divide-y divide-line">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 text-sm text-ink active:bg-paper-dim"
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-paper-dim px-4 py-3">
          {userInfo}
          <form action={logoutAction}>
            <button className="flex items-center gap-1.5 text-sm text-slate hover:text-ink" type="submit">
              <span className="text-base leading-none">🚪</span>
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
