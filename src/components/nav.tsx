import { logoutAction } from "@/lib/actions";
import { User } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { getUserAvatar } from "@/lib/queries";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./avatar";
import Link from "next/link";
import { NavIcon, type NavIconName } from "./nav-icon";
import { BottomNav } from "./bottom-nav";

export async function Nav({ user }: { user: User }) {
  const homeHref = user.role === "coach" ? "/coach/dashboard" : "/athlete";
  const [notifications, avatar] = await Promise.all([
    getNotifications(user.id),
    user.role === "athlete" ? getUserAvatar(user.id) : Promise.resolve(undefined),
  ]);

  const navItems: { href: string; label: string; icon: NavIconName }[] = [
    ...(user.role === "coach"
      ? [
          { href: "/coach/dashboard", icon: "dashboard" as const, label: "Tableau de bord" },
          { href: "/coach/nouvelle-seance", icon: "add" as const, label: "Créer" },
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

  // La barre du bas se limite à cinq onglets : au-delà, les libellés
  // deviennent illisibles sur un écran étroit. Paramètres y figure toujours —
  // c'est la seule navigation sur mobile, et on y trouve le compte, les
  // connexions de montre et les coachs liés : le tronquer les rendrait
  // inaccessibles.
  const settingsItem = navItems.find((i) => i.href === "/settings")!;
  const bottomNavItems = [...navItems.filter((i) => i.href !== "/settings").slice(0, 4), settingsItem];

  return (
    <>
      <header className="relative border-b border-line bg-white" style={{ viewTransitionName: "app-nav" }}>
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
        </div>
      </div>

    </header>

      {/* Navigation principale au pouce sur mobile ; sur grand écran, la barre
          du haut (ou la barre latérale côté coach) suffit. */}
      <BottomNav items={bottomNavItems} />
    </>
  );
}
