"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 70; // px de traîné avant de valider le changement de période
const WHEEL_IDLE_MS = 130; // temps sans molette avant de considérer le geste terminé
const COMMIT_MS = 220; // durée de l'animation de sortie avant la navigation
const SNAP_MS = 260; // durée du retour élastique quand le geste n'atteint pas le seuil

function withResistance(raw: number): number {
  const sign = Math.sign(raw);
  const abs = Math.abs(raw);
  if (abs <= THRESHOLD) return raw;
  const over = abs - THRESHOLD;
  return sign * (THRESHOLD + Math.sqrt(over) * 6);
}

// Fait suivre le contenu au doigt/à la molette en continu (translate en temps
// réel, pas de saut) puis, au relâchement, termine la sortie vers la période
// suivante/précédente (navigation) ou revient élastiquement à zéro si le
// geste n'a pas atteint le seuil — plutôt que "accumulation silencieuse puis
// bascule sèche". `axis="y"` (mois : on tourne les pages de haut en bas),
// `axis="x"` (semaine du tableau de bord : les jours défilent de gauche à
// droite, donc la navigation suit le même axe).
export function ScrollNav({
  prevHref,
  nextHref,
  axis = "y",
  children,
}: {
  prevHref: string;
  nextHref: string;
  axis?: "x" | "y";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const offset = useRef(0);
  const dragStart = useRef<number | null>(null);
  const wheelIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  const [transform, setTransform] = useState("translate(0px, 0px)");
  const [transitionMs, setTransitionMs] = useState(0);

  function translate(px: number) {
    return axis === "x" ? `translate(${px}px, 0px)` : `translate(0px, ${px}px)`;
  }

  function render() {
    setTransitionMs(0);
    setTransform(translate(offset.current));
  }

  function settle() {
    if (locked.current) return;
    const committed = Math.abs(offset.current) > THRESHOLD;
    if (!committed) {
      offset.current = 0;
      setTransitionMs(SNAP_MS);
      setTransform(translate(0));
      return;
    }
    locked.current = true;
    const direction = offset.current < 0 ? "next" : "prev";
    const exitDistance = (axis === "x" ? window.innerWidth : window.innerHeight) * 0.35;
    const exit = direction === "next" ? -exitDistance : exitDistance;
    setTransitionMs(COMMIT_MS);
    setTransform(translate(exit));
    setTimeout(() => {
      router.push(direction === "next" ? nextHref : prevHref);
      offset.current = 0;
      setTransitionMs(0);
      setTransform(translate(0));
      locked.current = false;
    }, COMMIT_MS);
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (locked.current) return;
    const delta = axis === "x" ? (e.deltaX !== 0 ? e.deltaX : e.deltaY) : e.deltaY;
    offset.current = withResistance(offset.current - delta);
    render();
    if (wheelIdleTimer.current) clearTimeout(wheelIdleTimer.current);
    wheelIdleTimer.current = setTimeout(settle, WHEEL_IDLE_MS);
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (locked.current) return;
    dragStart.current = axis === "x" ? e.touches[0].clientX : e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (dragStart.current === null || locked.current) return;
    e.preventDefault();
    const coord = axis === "x" ? e.touches[0].clientX : e.touches[0].clientY;
    offset.current = withResistance(coord - dragStart.current);
    render();
  }

  function handleTouchEnd() {
    dragStart.current = null;
    settle();
  }

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="overflow-hidden"
      style={{ touchAction: axis === "x" ? "pan-y" : "pan-x" }}
    >
      <div style={{ transform, transition: transitionMs ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none" }}>
        {children}
      </div>
    </div>
  );
}
