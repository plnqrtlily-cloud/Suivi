"use client";

import { useRouter } from "next/navigation";
import { navigateWithTransition } from "@/lib/view-transition";

// Lien qui navigue en utilisant l'API View Transitions du navigateur quand elle
// est disponible (Chrome/Edge, Safari récent) — un fondu enchaîné natif entre
// l'ancien et le nouveau contenu, sans bibliothèque d'animation. Se comporte
// comme une navigation normale (y compris ouverture dans un nouvel onglet via
// clic molette/Cmd) là où l'API n'existe pas.
export function DayLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateWithTransition(() => router.push(href));
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
