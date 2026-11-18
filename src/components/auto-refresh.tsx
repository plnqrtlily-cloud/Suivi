"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Calendrier partagé : ce que l'autre personne ajoute ou modifie apparaît sans
// recharger la page — au retour sur l'onglet ou l'app, puis à intervalle
// régulier tant que la page est à l'écran. router.refresh() garde l'état
// client (défilement, panneau ouvert) et ne refait que le rendu serveur.
export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      // Pas de rafraîchissement pendant une saisie : il pourrait perturber un formulaire ouvert.
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable)) return;
      // Ni pendant qu'une fenêtre est ouverte (détail d'un exercice, formulaire…).
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      last = Date.now();
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 5_000) tick();
    };
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, everyMs]);
  return null;
}
