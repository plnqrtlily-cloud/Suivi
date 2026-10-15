"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "./nav-icon";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: NavIconName;
  badge?: number;
}

// Barre d'onglets fixée en bas sur mobile, façon Instagram/TikTok : les
// destinations principales sont atteignables au pouce, sans ouvrir de menu.
// Remplace le menu hamburger, qui cachait la navigation derrière un clic.
// `center` : un élément inséré au milieu de la barre (l'onglet « + » de
// l'athlète), après la moitié des onglets.
export function BottomNav({ items, center }: { items: BottomNavItem[]; center?: React.ReactNode }) {
  const pathname = usePathname();

  // L'onglet actif est celui dont le chemin correspond le mieux : on prend le
  // plus long préfixe qui correspond, sinon "/athlete" resterait surligné en
  // consultant "/athlete/profile".
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white lg:hidden"
      // Marge de sécurité sur les iPhone à encoche, où le bas de l'écran est
      // partiellement masqué par la barre système.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {items.map((item, idx) => {
          const isActive = item.href === activeHref;
          const centerSlot =
            center && idx === Math.ceil(items.length / 2) ? (
              <li key="__center" className="flex flex-1 items-start justify-center">
                {center}
              </li>
            ) : null;
          return [
            centerSlot,
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] leading-tight transition-colors ${
                  isActive ? "font-semibold text-moss-dark" : "text-slate"
                }`}
              >
                <span className="relative flex">
                  <NavIcon name={item.icon} className="h-[22px] w-[22px]" />
                  {!!item.badge && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e8896a] px-1 text-[10px] font-bold text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            </li>,
          ];
        })}
      </ul>
    </nav>
  );
}
