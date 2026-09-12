"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { navigateWithTransition } from "@/lib/view-transition";

const THRESHOLD = 60; // px accumulés avant de déclencher le changement de mois
const COOLDOWN_MS = 550; // évite qu'un seul geste (molette à inertie, swipe) ne déclenche plusieurs changements

// Fait défiler la grille du mois de haut en bas pour naviguer au mois suivant
// ou précédent — capté uniquement sur la zone de la grille (pas la page
// entière) pour ne pas empêcher de faire défiler le reste de la page.
export function MonthScrollNav({
  prevHref,
  nextHref,
  children,
}: {
  prevHref: string;
  nextHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const accumulated = useRef(0);
  const locked = useRef(false);
  const touchStartY = useRef<number | null>(null);

  function navigate(direction: "prev" | "next") {
    if (locked.current) return;
    locked.current = true;
    accumulated.current = 0;
    navigateWithTransition(() => router.push(direction === "next" ? nextHref : prevHref));
    setTimeout(() => {
      locked.current = false;
    }, COOLDOWN_MS);
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (locked.current) return;
    accumulated.current += e.deltaY;
    if (accumulated.current > THRESHOLD) navigate("next");
    else if (accumulated.current < -THRESHOLD) navigate("prev");
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (touchStartY.current !== null) e.preventDefault();
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (touchStartY.current === null || locked.current) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;
    if (delta > THRESHOLD) navigate("next");
    else if (delta < -THRESHOLD) navigate("prev");
  }

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="touch-pan-x"
    >
      {children}
    </div>
  );
}
