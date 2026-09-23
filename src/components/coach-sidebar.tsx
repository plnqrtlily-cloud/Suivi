import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import { User } from "@/lib/auth";
import { getAthletesForCoach, getUnreadMessageCountForCoach } from "@/lib/queries";
import { ADMIN_EMAIL } from "@/lib/billing";
import { Avatar } from "./avatar";
import { NavIcon, type NavIconName } from "./nav-icon";

// Barre latérale persistante côté coach (concept A) : toutes les sections
// restent accessibles sans repasser par l'accueil, plus un accès rapide aux
// athlètes suivis. Masquée sous lg: — sur mobile, le menu hamburger existant
// dans <Nav> reste la navigation, inchangé.
export async function CoachSidebar({ user, activeHref }: { user: User; activeHref?: string }) {
  if (user.role !== "coach") return null;

  const [links, unreadCount] = await Promise.all([
    getAthletesForCoach(user.id),
    getUnreadMessageCountForCoach(user.id),
  ]);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);

  const sections: { href: string; label: string; icon: NavIconName; badge?: number }[] = [
    { href: "/coach/dashboard", icon: "dashboard", label: "Tableau de bord" },
    { href: "/coach/equipes", icon: "pitch", label: "Équipes" },
    { href: "/coach/nouvelle-seance", icon: "add", label: "Créer une séance" },
    { href: "/coach/planification", icon: "calendar", label: "Planification" },
    { href: "/coach/messagerie", icon: "messages", label: "Messagerie", badge: unreadCount || undefined },
    { href: "/coach/resources", icon: "library", label: "Bibliothèque" },
  ];

  function itemClass(href: string) {
    const isActive = activeHref === href;
    return `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
      isActive ? "bg-moss/10 font-medium text-moss-dark" : "text-ink-soft hover:bg-paper-dim"
    }`;
  }

  return (
    <aside className="hidden w-[190px] shrink-0 flex-col border-r border-line bg-white lg:flex">
      <Link href="/coach/dashboard" className="px-4 pb-2 pt-4 font-display text-lg text-ink">
        Rythme
      </Link>

      <div className="flex flex-col gap-0.5 px-2 py-1">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className={itemClass(s.href)}>
            <NavIcon name={s.icon} className="h-[17px] w-[17px]" />
            {s.label}
            {s.badge ? (
              <span className="ml-auto rounded-full bg-moss px-1.5 text-[11px] font-semibold text-white">{s.badge}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {activeAthletes.length > 0 && (
        <>
          <p className="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate">Accès rapide</p>
          <div className="flex flex-col gap-0.5 px-2">
            {activeAthletes.slice(0, 8).map((l) => (
              <Link
                key={l.link_id}
                href={`/coach/athletes/${l.athlete_id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-ink-soft hover:bg-paper-dim"
              >
                <Avatar userId={l.athlete_id!} firstName={l.first_name || "?"} hasAvatar={!!l.avatar_path} size="sm" />
                <span className="truncate">
                  {l.first_name} {l.last_name}
                </span>
              </Link>
            ))}
            {activeAthletes.length > 8 && (
              <Link href="/coach/dashboard" className="px-3 py-1.5 text-xs text-slate hover:underline">
                + {activeAthletes.length - 8} autre{activeAthletes.length - 8 > 1 ? "s" : ""}
              </Link>
            )}
          </div>
        </>
      )}

      <div className="mt-auto flex flex-col gap-0.5 border-t border-line px-2 py-2">
        {user.email === ADMIN_EMAIL && (
          <Link href="/admin" className={itemClass("/admin")}>
            <span className="h-[17px] w-[17px]" aria-hidden />
            Admin
          </Link>
        )}
        <Link href="/tarifs" className={itemClass("/tarifs")}>
          <span className="h-[17px] w-[17px]" aria-hidden />
          Tarifs
        </Link>
        <Link href="/settings" className={itemClass("/settings")}>
          <NavIcon name="settings" className="h-[17px] w-[17px]" />
          Paramètres
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate hover:bg-paper-dim hover:text-ink"
          >
            <NavIcon name="logout" className="h-[17px] w-[17px]" />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}
