import { logoutAction } from "@/lib/actions";
import { User } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { getUserAvatar } from "@/lib/queries";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./avatar";
import Link from "next/link";

type NavIconName = "calendar" | "library" | "profile" | "messages" | "settings" | "logout";

function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const common = {
    viewBox: "0 0 20 20",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="14" height="12" rx="2" />
          <path d="M3 8.5h14" />
          <path d="M6.5 2.5v3M13.5 2.5v3" />
        </svg>
      );
    case "library":
      return (
        <svg {...common}>
          <path d="M3 4.5c1.5-1 3.5-1 5 0v11c-1.5-1-3.5-1-5 0z" />
          <path d="M17 4.5c-1.5-1-3.5-1-5 0v11c1.5-1 3.5-1 5 0z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="10" cy="7" r="3" />
          <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        </svg>
      );
    case "messages":
      return (
        <svg {...common}>
          <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M3 6h8M15 6h2" />
          <circle cx="12" cy="6" r="2" />
          <path d="M3 10h2M9 10h8" />
          <circle cx="6" cy="10" r="2" />
          <path d="M3 14h5M13 14h4" />
          <circle cx="10" cy="14" r="2" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M8 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
          <path d="M13 14l4-4-4-4" />
          <path d="M17 10H7" />
        </svg>
      );
  }
}

export async function Nav({ user }: { user: User }) {
  const homeHref = user.role === "coach" ? "/coach" : "/athlete";
  const notifications = await getNotifications(user.id);
  const avatar = user.role === "athlete" ? await getUserAvatar(user.id) : undefined;

  const navItems: { href: string; label: string; icon: NavIconName }[] = [
    { href: homeHref, icon: "calendar", label: user.role === "coach" ? "Mes athlètes" : "Mon calendrier" },
    ...(user.role === "coach" ? [{ href: "/coach/resources", icon: "library" as const, label: "Bibliothèque" }] : []),
    ...(user.role === "athlete"
      ? [
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
