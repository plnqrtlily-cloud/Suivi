"use client";

import { useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

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
function isTab(v: string | null): v is AthleteTab {
  return !!v && ATHLETE_TABS.some((t) => t.value === v);
}

export function AthleteTabs({
  panels,
  storageKey,
}: {
  panels: Record<AthleteTab, React.ReactNode>;
  storageKey: string;
}) {
  const params = useSearchParams();
  const tabParam = params.get("tab");
  // Priorité : ?tab= (liens internes « Voir la santé »…), puis ?view= (la
  // navigation du calendrier ramène sur le calendrier), puis le dernier
  // onglet consulté pour cet athlète.
  const fromUrl: AthleteTab | null = isTab(tabParam) ? tabParam : params.get("view") ? "programmation" : null;
  const saved = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const v = window.localStorage.getItem(storageKey);
        return isTab(v) ? v : null;
      } catch {
        return null; // Stockage indisponible (navigation privée).
      }
    },
    () => null
  );
  const [picked, setPicked] = useState<{ url: AthleteTab | null; tab: AthleteTab | null }>({ url: fromUrl, tab: null });
  if (picked.url !== fromUrl) setPicked({ url: fromUrl, tab: null });
  const active: AthleteTab = (picked.url === fromUrl ? picked.tab : null) ?? fromUrl ?? saved ?? "apercu";

  function select(tab: AthleteTab) {
    setPicked({ url: fromUrl, tab });
    try {
      window.localStorage.setItem(storageKey, tab);
    } catch {
      // Sans persistance, le choix reste valable pour la session en cours.
    }
    const next = new URLSearchParams(window.location.search);
    next.set("tab", tab);
    window.history.replaceState(null, "", `?${next.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div role="tablist" className="mb-8 flex gap-2 overflow-x-auto border-b border-line">
        {ATHLETE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={active === t.value}
            aria-controls={`panel-${t.value}`}
            onClick={() => select(t.value)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[15px] transition-colors ${
              active === t.value
                ? "border-moss-dark font-semibold text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ATHLETE_TABS.map((t) => (
        <div
          key={t.value}
          role="tabpanel"
          id={`panel-${t.value}`}
          aria-labelledby={`tab-${t.value}`}
          hidden={active !== t.value}
          className="animate-expand-in"
        >
          {panels[t.value]}
        </div>
      ))}
    </>
  );
}
