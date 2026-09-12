"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const SETTLE_MS = 100; // temps sans scroll avant de considérer le geste terminé

// Défilement continu façon calendrier Apple : le panneau précédent/courant/
// suivant sont posés côte à côte (ou l'un sous l'autre) dans un conteneur au
// scroll natif du navigateur — c'est le moteur de scroll du navigateur qui
// fournit l'inertie/la décélération, pas une physique réimplémentée en JS
// (contrairement à la version précédente, qui accumulait un delta puis
// tranchait sec entre "annuler" et "valider"). `scroll-snap` aligne toujours
// sur l'un des trois panneaux ; une fois le geste stabilisé sur le panneau
// précédent ou suivant, on navigue puis on recentre instantanément sur le
// panneau du milieu dès que les nouvelles données arrivent — l'utilisateur
// ne voit jamais le recentrage, seulement une continuité infinie.
//
// Les positions des panneaux sont déduites par arithmétique (index × taille
// d'un panneau) plutôt que lues via offsetTop/offsetLeft : ces propriétés sont
// relatives au offsetParent positionné le plus proche, qui n'est pas forcément
// le conteneur de scroll lui-même — s'y fier a produit un recentrage sur le
// mauvais panneau lors des premiers essais.
export function SnapScrollNav({
  panes,
  panesKey,
  prevHref,
  nextHref,
  axis = "y",
  paneSize,
}: {
  panes: [React.ReactNode, React.ReactNode, React.ReactNode];
  panesKey: string;
  prevHref: string;
  nextHref: string;
  axis?: "x" | "y";
  // Hauteur (en px) d'un panneau pour l'axe vertical — un bloc en flux normal
  // a une largeur à 100% de son parent "gratuitement" (donc l'axe horizontal
  // n'en a pas besoin, cf. le défilement de semaine), mais sa hauteur est
  // "auto" par défaut : sans cette valeur, le conteneur grandirait pour
  // afficher les trois panneaux à la fois plutôt que de n'en laisser voir
  // qu'un et faire défiler les deux autres.
  paneSize?: number;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigating = useRef(false);

  // Recentre sur le panneau du milieu à chaque nouveau jeu de données — au
  // montage, et juste après qu'une navigation ait fait arriver le mois/la
  // semaine suivant·e comme nouveau panneau central.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const unit = axis === "x" ? el.clientWidth : el.clientHeight;
    if (axis === "x") el.scrollLeft = unit;
    else el.scrollTop = unit;
    navigating.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panesKey, axis]);

  function handleScroll() {
    if (navigating.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const pos = axis === "x" ? el.scrollLeft : el.scrollTop;
      const unit = axis === "x" ? el.clientWidth : el.clientHeight;
      if (!unit) return;
      const center = pos + unit / 2;
      if (center < unit) {
        navigating.current = true;
        router.push(prevHref);
      } else if (center > unit * 2) {
        navigating.current = true;
        router.push(nextHref);
      }
    }, SETTLE_MS);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={
        axis === "x"
          ? "snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
      style={axis === "x" ? { display: "flex" } : paneSize ? { height: paneSize } : undefined}
    >
      <div className={axis === "x" ? "w-full flex-shrink-0 snap-start" : "snap-start"}>{panes[0]}</div>
      <div className={axis === "x" ? "w-full flex-shrink-0 snap-start" : "snap-start"}>{panes[1]}</div>
      <div className={axis === "x" ? "w-full flex-shrink-0 snap-start" : "snap-start"}>{panes[2]}</div>
    </div>
  );
}
