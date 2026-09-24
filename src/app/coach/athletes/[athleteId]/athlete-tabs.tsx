"use client";

import { useState, useEffect } from "react";
import { flushSync } from "react-dom";

export const ATHLETE_TABS = [
  { value: "apercu", label: "Aperçu" },
  { value: "programmation", label: "Calendrier" },
  { value: "periodisation", label: "Périodisation" },
  { value: "mesures", label: "Mesures" },
  { value: "sante", label: "Santé" },
  { value: "notes", label: "Notes" },
] as const;

export type AthleteTab = (typeof ATHLETE_TABS)[number]["value"];

// Onglets plutôt qu'une page unique de 14 sections empilées : chaque thème
// reste court à lire. Le contenu de tous les onglets est rendu côté serveur et
// simplement masqué en CSS — changer d'onglet est instantané, sans
// rechargement ni perte de la position de défilement.
export function AthleteTabs({
  children,
  storageKey,
}: {
  children: Record<AthleteTab, React.ReactNode>;
  storageKey: string;
}) {
  const [active, setActive] = useState<AthleteTab>("apercu");

  // Le dernier onglet consulté est mémorisé par athlète : un coach qui suit
  // surtout la programmation d'un athlète y revient directement.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && ATHLETE_TABS.some((t) => t.value === saved)) setActive(saved as AthleteTab);
    } catch {
      // Stockage indisponible (navigation privée) — on garde l'onglet par défaut.
    }
  }, [storageKey]);

  function select(tab: AthleteTab) {
    function apply() {
      setActive(tab);
      try {
        window.localStorage.setItem(storageKey, tab);
      } catch {
        // Sans persistance, le choix reste valable pour la session en cours.
      }
    }
    // Même fondu court que les transitions de page (cf. globals.css) : le
    // changement d'onglet ne navigue nulle part, donc rien ne le déclenchait
    // jusqu'ici — flushSync force le changement de DOM à se produire de façon
    // synchrone dans le callback, condition requise par l'API pour capturer
    // l'état "avant" puis "après".
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      document.startViewTransition(() => flushSync(apply));
    } else {
      apply();
    }
  }

  return (
    <>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {ATHLETE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => select(t.value)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-sm transition-colors ${
              active === t.value
                ? "border-moss font-semibold text-moss-dark"
                : "border-transparent text-slate hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Nom dédié : le fondu du changement d'onglet ne doit crossfader que ce
          bloc, pas la sidebar/nav (déjà exclues par ailleurs) ni le reste de
          la page — cf. règle ::view-transition-*(athlete-tab-content) dans
          globals.css. */}
      <div style={{ viewTransitionName: "athlete-tab-content" }}>
        {ATHLETE_TABS.map((t) => (
          <div key={t.value} hidden={active !== t.value}>
            {children[t.value]}
          </div>
        ))}
      </div>
    </>
  );
}
