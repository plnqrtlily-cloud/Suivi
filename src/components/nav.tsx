import { logoutAction } from "@/lib/actions";
import { TEAMS_ENABLED } from "@/lib/features";
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
      ? dbGet<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM messages WHERE athlete_id = ? AND sender_id != ? AND read_at IS NULL)
                + (SELECT COUNT(*) FROM health_messages h JOIN injuries i ON i.id = h.injury_id
                   WHERE i.athlete_id = ? AND h.author_id != ? AND h.kind = 'message' AND h.read_at IS NULL) as n`,
          [user.id, user.id, user.id, user.id]
        )
      : dbGet<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM messages WHERE coach_id = ? AND sender_id != ? AND read_at IS NULL)
                + (SELECT COUNT(*) FROM health_messages h JOIN injuries i ON i.id = h.injury_id
                   JOIN coach_athlete_links l ON l.athlete_id = i.athlete_id AND l.coach_id = ? AND l.status = 'active'
                   WHERE h.author_id != ? AND h.kind = 'message' AND h.read_at IS NULL) as n`,
          [user.id, user.id, user.id, user.id]
        ),
  ]);
  const unreadMessages = Number(unread?.n ?? 0);
  const coachName = coaches.length === 1 ? coaches[0].first_name : "ton coach";

  const navItems: { href: string; label: string; icon: NavIconName }[] = [
    ...(user.role === "coach"
      ? [
          { href: "/coach/dashboard", icon: "dashboard" as const, label: "Tableau de bord" },
          ...(TEAMS_ENABLED ? [{ href: "/coach/equipes", icon: "pitch" as const, label: "Équipes" }] : []),
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

  // Côté athlète, « Moi » regroupe le profil et les paramètres (lien en tête
  // du profil) : la barre garde 4 onglets autour du « + ».
  // Côté coach, même principe : 4 onglets courts autour d'un « + » central
  // (Créer une séance) ; Paramètres passe en icône dans l'en-tête mobile.
  const coachBottomItems: { href: string; label: string; icon: NavIconName; badge?: number }[] = [
    { href: "/coach/dashboard", icon: "dashboard", label: "Accueil" },
    { href: "/coach/planification", icon: "calendar", label: "Planning" },
    { href: "/coach/messagerie", icon: "messages", label: "Messages", badge: unreadMessages },
    { href: "/coach/resources", icon: "library", label: "Biblio" },
  ];
  const bottomNavItems = isAthlete
    ? navItems.filter((i) => i.href !== "/settings").map((i) => (i.href === "/athlete/messages" ? { ...i, badge: unreadMessages } : i))
    : coachBottomItems;
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

        <div className="flex items-center gap-1 lg:hidden">
          <NotificationBell notifications={notifications} />
          {!isAthlete && (
            <Link href="/settings" aria-label="Paramètres" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-paper-dim">
              <NavIcon name="settings" className="h-[20px] w-[20px]" />
            </Link>
          )}
        </div>
      </div>

    </header>

      {/* Navigation principale au pouce sur mobile ; sur grand écran, la barre
          du haut (ou la barre latérale côté coach) suffit. */}
      <BottomNav
        items={bottomNavItems}
        center={
          isAthlete ? (
            <AddMenu variant="tab" today={today} coachName={coachName} isFemale={gender === "female"} />
          ) : (
            <Link
              href="/coach/nouvelle-seance"
              aria-label="Créer une séance"
              className="-mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#1b4b4f] text-white shadow-[0_6px_16px_rgba(27,75,79,0.35)]"
            >
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M10 4.5v11M4.5 10h11" />
              </svg>
            </Link>
          )
        }
      />
    </>
  );
}
