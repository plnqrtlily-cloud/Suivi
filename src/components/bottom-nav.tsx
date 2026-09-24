"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "./nav-icon";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

// Barre d'onglets fixée en bas sur mobile, façon Instagram/TikTok : les
// destinations principales sont atteignables au pouce, sans ouvrir de menu.
// Remplace le menu hamburger, qui cachait la navigation derrière un clic.
export function BottomNav({ items }: { items: BottomNavItem[] }) {
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
      style={{ paddingBottom: "env(safe-area-inset-bottom)", viewTransitionName: "app-bottom-nav" }}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] leading-tight transition-colors ${
                  isActive ? "font-semibold text-moss-dark" : "text-slate"
                }`}
              >
                <NavIcon name={item.icon} className="h-[22px] w-[22px]" />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
