"use client";

import { useState } from "react";
import Link from "next/link";
import { sportLabel } from "@/components/ui";

const SPORTS = ["running", "cycling", "hiking", "swimming", "climbing", "strength"];
const CATEGORY_LABELS: Record<string, string> = {
  objectif: "Objectif",
  evenement: "Événement",
  entrainement: "Entraînement",
  divers: "Divers",
};

export function CalendarFilters({
  offset,
  sport,
  category,
}: {
  offset: number;
  sport?: string;
  category?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = (sport ? 1 : 0) + (category ? 1 : 0);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
          activeCount > 0 ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-ink-soft"
        }`}
        aria-expanded={open}
      >
        Filtre
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-moss px-1 text-[10px] font-medium text-white">
            {activeCount}
          </span>
        )}
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-3 text-sm">
          <span className="text-slate">Sport :</span>
          {SPORTS.map((s) => (
            <Link
              key={s}
              href={`/athlete?week=${offset}&sport=${sport === s ? "" : s}${category ? `&category=${category}` : ""}`} scroll={false}
              className={`rounded-full border px-2.5 py-0.5 ${sport === s ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-slate"}`}
            >
              {sportLabel(s)}
            </Link>
          ))}
          <span className="ml-3 text-slate">Catégorie :</span>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={`/athlete?week=${offset}&category=${category === value ? "" : value}${sport ? `&sport=${sport}` : ""}`} scroll={false}
              className={`rounded-full border px-2.5 py-0.5 ${category === value ? "border-clay bg-clay/10 text-clay" : "border-line text-slate"}`}
            >
              {label}
            </Link>
          ))}
          {activeCount > 0 && (
            <Link href={`/athlete?week=${offset}`} scroll={false} className="ml-2 text-xs text-slate underline">
              Réinitialiser
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
