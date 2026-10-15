import { logoutAction } from "@/lib/actions";
import { User } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { getUserAvatar, getCoachesForAthlete, getUserGender } from "@/lib/queries";
import { dbGet } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { AddMenu } from "./add-menu";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./avatar";
import Link from "next/link";
import { NavIcon, type NavIconName } from "./nav-icon";
import { BottomNav } from "./bottom-nav";

export async function Nav({ user }: { user: User }) {
  const homeHref = user.role === "coach" ? "/coach/dashboard" : "/athlete";
  const isAthlete = user.role === "athlete";
  const [notifications, avatar, coaches, gender, unread] = await Promise.all([
    getNotifications(user.id),
    isAthlete ? getUserAvatar(user.id) : Promise.resolve(undefined),
    isAthlete ? getCoachesForAthlete(user.id) : Promise.resolve([]),
    isAthlete ? getUserGender(user.id) : Promise.resolve(null),
    isAthlete
      ? dbGet<{ n: number }>(`SELECT COUNT(*) as n FROM messages WHERE athlete_id = ? AND sender_id != ? AND read_at IS NULL`, [user.id, user.id])
      : Promise.resolve(undefined),
  ]);
  const unreadMessages = Number(unread?.n ?? 0);
  const coachName = coaches.length === 1 ? coaches[0].first_name : "ton coach";

  const navItems: { href: string; label: string; icon: NavIconName }[] = [
    ...(user.role === "coach"
      ? [
          { href: "/coach/dashboard", icon: "dashboard" as const, label: "Tableau de bord" },
          { href: "/coach/equipes", icon: "pitch" as const, label: "Équipes" },
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
          { href: "/athlete/messages", icon: "messages" as const, label: "Messages" },
          { href: "/athlete/profile", icon: "profile" as const, label: "Moi" },
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

  // Toutes les destinations passent dans la barre du bas plutôt qu'un
  // sous-ensemble arbitraire : Équipes n'y figurait pas du tout jusqu'ici, ce
  // qui la rendait injoignable sur mobile pour un coach (elle n'existe que
  // dans la sidebar desktop). BottomNav répartit ses items en `flex-1` et
  // tronque les libellés trop longs, donc élargir la liste (5 pour l'athlète,
  // 7 pour le coach) reste lisible sans logique de troncature séparée à
  // maintenir. Paramètres reste toujours en dernier : c'est la seule
  // navigation sur mobile vers le compte, les connexions de montre et les
  // coachs liés.
  // Côté athlète, « Moi » regroupe le profil et les paramètres (lien en tête
  // du profil) : la barre garde 4 onglets autour du « + ».
  const settingsItem = navItems.find((i) => i.href === "/settings")!;
  const bottomNavItems = isAthlete
    ? navItems.filter((i) => i.href !== "/settings").map((i) => (i.href === "/athlete/messages" ? { ...i, badge: unreadMessages } : i))
    : [...navItems.filter((i) => i.href !== "/settings"), settingsItem];
  const today = todayISO();

  return (
    <>
      <header className="relative border-b border-line bg-white">
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
          {isAthlete && <AddMenu variant="header" today={today} coachName={coachName} isFemale={gender === "female"} />}
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
      <BottomNav
        items={bottomNavItems}
        center={isAthlete ? <AddMenu variant="tab" today={today} coachName={coachName} isFemale={gender === "female"} /> : undefined}
      />
    </>
  );
}
