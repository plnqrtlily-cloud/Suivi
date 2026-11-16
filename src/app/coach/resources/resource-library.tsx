"use client";

import { useMemo, useState } from "react";
import { ResourceCard } from "./resource-card";
import { byTitle, matchesSearch } from "@/lib/search-text";

// Bibliothèque rangée par ordre alphabétique, avec recherche instantanée sur le
// titre, la consigne et le sport (accents et majuscules ignorés).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ResourceLibrary({ resources }: { resources: any[] }) {
  const [q, setQ] = useState("");
  const sorted = useMemo(() => [...resources].sort(byTitle), [resources]);
  const shown = sorted.filter((r) => matchesSearch(q, r.title, r.description, r.sport));

  return (
    <div>
      <div className="relative mb-4">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Rechercher parmi ${resources.length} ressource${resources.length > 1 ? "s" : ""} (squat, gainage, élastique…)`}
          aria-label="Rechercher dans la bibliothèque"
          className="w-full rounded-full border border-line bg-white py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none focus:border-moss"
        />
      </div>
      {q && (
        <p className="mb-3 text-sm text-slate">
          {shown.length} résultat{shown.length > 1 ? "s" : ""}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="text-sm text-slate">Aucune ressource ne correspond à « {q} ».</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {shown.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}
