import { logoutAction } from "@/lib/actions";
import { User } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { getUserAvatar } from "@/lib/queries";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./avatar";
import Link from "next/link";
import { NavIcon, type NavIconName } from "./nav-icon";

export async function Nav({ user }: { user: User }) {
  const homeHref = user.role === "coach" ? "/coach" : "/athlete";
  const [notifications, avatar] = await Promise.all([
    getNotifications(user.id),
    user.role === "athlete" ? getUserAvatar(user.id) : Promise.resolve(undefined),
  ]);

  const navItems: { href: string; label: string; icon: NavIconName }[] = [
    ...(user.role === "coach"
      ? [
          { href: "/coach/dashboard", icon: "dashboard" as const, label: "Tableau de bord" },
          { href: "/coach/planification", icon: "calendar" as const, label: "Planification" },
          { href: "/coach/messagerie", icon: "messages" as const, label: "Messagerie" },
          { href: "/coach/resources", icon: "library" as const, label: "Bibliothèque" },
        ]
      : []),
    ...(user.role === "athlete"
      ? [
          { href: "/athlete", icon: "home" as const, label: "Aujourd'hui" },
          { href: "/athlete/programmation", icon: "calendar" as const, label: "Calendrier" },
          { href: "/athlete/profile", icon: "profile" as const, label: "Mon profil" },
          { href: "/athlete/messages", icon: "messages" as const, label: "Messages" },
        ]
      : []),
    { href: "/settings", icon: "settings", label: "Paramètres" },
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
          Rythme
        </Link>

        <nav className="hidden items-center gap-5 text-sm lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 whitespace-nowrap text-ink-soft hover:text-ink"
            >
              <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          ))}
          <NotificationBell notifications={notifications} />
          {userInfo}
          <form action={logoutAction}>
            <button
              className="flex items-center gap-1.5 whitespace-nowrap text-slate hover:text-ink"
              type="submit"
            >
              <NavIcon name="logout" className="h-[18px] w-[18px]" />
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
              <NavIcon name={item.icon} className="h-5 w-5 text-ink-soft" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-paper-dim px-4 py-3">
          {userInfo}
          <form action={logoutAction}>
            <button className="flex items-center gap-1.5 text-sm text-slate hover:text-ink" type="submit">
              <NavIcon name="logout" className="h-5 w-5" />
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
