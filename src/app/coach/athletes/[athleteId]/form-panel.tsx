"use client";

import { useState } from "react";
import { computeGlobalScore, computeHooperIndex, scoreLabel, scoreColor } from "@/lib/checkin-types";
import type { Checkin } from "@/lib/checkin-types";
import { TrendChart } from "@/components/trend-chart";

// Les cinq items du questionnaire, avec leur polarité : « haut = bon » pour la
// forme et le sommeil, « haut = mauvais » pour les courbatures et le stress.
// Sans cette distinction, un 8 en stress se lirait comme une bonne nouvelle.
const ITEMS: { key: keyof Checkin; label: string; higherIsBetter: boolean }[] = [
  { key: "physical_level", label: "Forme physique", higherIsBetter: true },
  { key: "mental_level", label: "Forme mentale", higherIsBetter: true },
  { key: "sleep_quality", label: "Qualité du sommeil", higherIsBetter: true },
  { key: "soreness", label: "Courbatures", higherIsBetter: false },
  { key: "stress", label: "Stress", higherIsBetter: false },
];

function barColor(value: number, higherIsBetter: boolean): string {
  const good = higherIsBetter ? value >= 7 : value <= 3;
  const bad = higherIsBetter ? value <= 3 : value >= 8;
  if (good) return "#1B4B4F";
  if (bad) return "#B85A3E";
  return "#E8896A";
}

function fr(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Détail d'un check-in : les cinq items du questionnaire, item par item. */
function CheckinDetail({ checkin }: { checkin: Checkin }) {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      {ITEMS.map((item) => {
        const value = checkin[item.key] as number;
        return (
          <div key={item.key} className="flex items-center gap-2">
            <span className="w-36 shrink-0 text-xs text-slate">{item.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-dim">
              <span
                className="block h-2 rounded-full"
                style={{ width: `${value * 10}%`, backgroundColor: barColor(value, item.higherIsBetter) }}
              />
            </span>
            <span className="w-8 shrink-0 text-right text-xs font-semibold text-ink">{value}</span>
          </div>
        );
      })}
      <p className="text-[11px] text-slate">
        Indice de Hooper : {computeHooperIndex(checkin)}/50 — plus bas, meilleur l&apos;état.
      </p>
      {checkin.notes && <p className="text-sm text-ink-soft">{checkin.notes}</p>}
    </div>
  );
}

/**
 * Carte « Forme du jour » : le score seul ne dit pas d'où il vient. Un clic
 * déplie les cinq items, ce qui distingue une fatigue de sommeil d'un pic de
 * stress — deux situations qui appellent des décisions opposées.
 */
export function FormOfTheDay({ checkin }: { checkin: Checkin }) {
  const [open, setOpen] = useState(false);
  const score = computeGlobalScore(checkin);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <span>
          <span className={`block text-lg font-semibold ${scoreColor(score)}`}>
            {score}/10 · {scoreLabel(score)}
          </span>
          <span className="block text-xs text-slate">Relevé le {checkin.check_date}</span>
        </span>
        <span className="mt-1 shrink-0 text-xs font-semibold text-slate">{open ? "Masquer" : "Détail"}</span>
      </button>
      {open && <CheckinDetail checkin={checkin} />}
    </div>
  );
}

/**
 * Évolution de la forme sur la période du bilan. Le score global porte la
 * courbe ; chaque relevé reste consultable en détail, parce que c'est la
 * composante qui a bougé, pas la moyenne, qui explique une baisse.
 */
export function FormHistory({ checkins }: { checkins: Checkin[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (checkins.length === 0) {
    return <p className="text-sm text-slate">Aucun relevé de forme sur cette période.</p>;
  }

  const series = checkins.map((c) => ({ value: computeGlobalScore(c), recorded_at: c.check_date }));
  const scores = series.map((s) => s.value);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const lowest = checkins[scores.indexOf(Math.min(...scores))];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-slate">
          Moyenne <span className={`font-semibold ${scoreColor(avg)}`}>{avg}/10</span>
        </span>
        <span className="text-slate">
          {checkins.length} relevé{checkins.length > 1 ? "s" : ""}
        </span>
        <span className="text-slate">
          Point bas le {fr(lowest.check_date)} ({computeGlobalScore(lowest)}/10)
        </span>
      </div>

      {series.length > 1 ? (
        <TrendChart series={series} unit="/10" />
      ) : (
        <p className="mb-3 text-xs text-slate">Un seul relevé : pas encore de courbe.</p>
      )}

      <ul className="mt-3 flex flex-col gap-1">
        {[...checkins].reverse().map((c) => {
          const score = computeGlobalScore(c);
          const isOpen = openId === c.id;
          return (
            <li key={c.id} className="rounded-xl border border-line px-3 py-2">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : c.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="text-xs text-slate">{fr(c.check_date)}</span>
                <span className={`text-sm font-semibold ${scoreColor(score)}`}>{score}/10</span>
                <span className="truncate text-xs text-slate">{scoreLabel(score)}</span>
                <span className="ml-auto shrink-0 text-xs text-slate">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && <CheckinDetail checkin={c} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
