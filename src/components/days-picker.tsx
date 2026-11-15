"use client";

import { useState } from "react";
import { getMonthGrid, monthLabel } from "@/lib/dates";
import { dateRangeToList } from "@/components/date-range-picker";
import { consecutiveRuns } from "@/lib/day-runs";

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

// Choix des jours pour tout ce qui s'enregistre dans le calendrier (séance,
// événement, indisponibilité…), côté athlète comme côté coach. Deux façons de
// sélectionner :
//  - « Jours au choix » : chaque jour touché s'ajoute ou se retire (ex. mardi
//    et jeudi), sur plusieurs mois si besoin ;
//  - « Période » : un premier jour puis un dernier, tous les jours entre les
//    deux sont pris (stage, vacances…).
// Chaque appelant crée une entrée par jour retenu (ou, pour un événement, un
// événement par suite de jours consécutifs).
export function DaysPicker({
  value,
  onChange,
  rangeOnly = false,
  max,
  min,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
  /** Uniquement une période continue (modification d'un événement existant). */
  rangeOnly?: boolean;
  /** Jours sélectionnables au plus tard / au plus tôt (ex. une séance déjà faite ne peut pas être future). */
  max?: string;
  min?: string;
}) {
  const sorted = [...value].sort();
  const initial = sorted[0] ? new Date(`${sorted[0]}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth() + 1);
  const [mode, setMode] = useState<"days" | "range">(rangeOnly ? "range" : "days");
  // Mode période : premier jour posé, en attente du dernier.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const grid = getMonthGrid(viewYear, viewMonth);
  const selected = new Set(value);

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  }

  const allowed = (date: string) => (!max || date <= max) && (!min || date >= min);

  function click(date: string) {
    if (!allowed(date)) return;
    if (mode === "days") {
      onChange(selected.has(date) ? value.filter((d) => d !== date) : [...value, date].sort());
      return;
    }
    if (!anchor) {
      setAnchor(date);
      onChange([date]);
    } else {
      const [a, b] = anchor < date ? [anchor, date] : [date, anchor];
      setAnchor(null);
      onChange(dateRangeToList(a, b).filter(allowed));
    }
  }

  // Aperçu de la période entre le premier jour posé et le jour survolé.
  const preview = mode === "range" && anchor && hover ? (anchor < hover ? [anchor, hover] : [hover, anchor]) : null;

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      {!rangeOnly && (
        <div className="mb-3 flex rounded-full bg-paper-dim p-[3px] text-[12.5px] font-semibold">
          {(
            [
              ["days", "Jours au choix"],
              ["range", "Période"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setAnchor(null);
              }}
              className={`flex-1 rounded-full px-3 py-1.5 ${mode === m ? "bg-white text-ink shadow-sm" : "text-slate"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      <p className="mb-2 text-center text-xs text-slate">
        {mode === "days" ? "Touchez chaque jour concerné." : anchor ? "Touchez le dernier jour." : "Touchez le premier jour, puis le dernier."}
      </p>

      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Mois précédent" onClick={() => shiftMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </button>
        <p className="text-sm font-semibold capitalize text-ink-soft">{monthLabel(viewYear, viewMonth)}</p>
        <button type="button" aria-label="Mois suivant" onClick={() => shiftMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {DAY_LETTERS.map((l, i) => (
          <span key={i} className="text-center text-[10px] uppercase text-slate">
            {l}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((cell) => {
          const on = selected.has(cell.date);
          const inPreview = !!preview && cell.date >= preview[0] && cell.date <= preview[1];
          const ok = cell.inMonth && allowed(cell.date);
          return (
            <button
              key={cell.date}
              type="button"
              disabled={!ok}
              aria-pressed={on}
              aria-label={cell.date}
              onClick={() => click(cell.date)}
              onMouseEnter={() => setHover(cell.date)}
              onMouseLeave={() => setHover(null)}
              className="flex h-9 items-center justify-center"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                  on
                    ? "bg-moss-dark text-white"
                    : inPreview
                      ? "bg-[#e3eeed] text-ink"
                      : !cell.inMonth
                        ? "text-transparent"
                        : ok
                          ? "text-ink hover:bg-paper-dim"
                          : "text-line"
                }`}
              >
                {cell.day}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="min-w-0 text-[13px] font-semibold text-ink-soft">{summary(sorted)}</p>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setAnchor(null);
              onChange([]);
            }}
            className="flex-shrink-0 text-[12.5px] font-semibold text-slate hover:text-ink"
          >
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

function short(iso: string, withDow = false) {
  const d = new Date(`${iso}T00:00:00`);
  return `${withDow ? `${DOW_SHORT[d.getDay()]} ` : ""}${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** « Aucun jour », « mar. 17 nov. », « Du 20 nov. au 22 nov. · 3 jours », « 3 jours : mar. 17, jeu. 19… » */
export function summary(dates: string[]) {
  if (!dates.length) return "Aucun jour sélectionné";
  if (dates.length === 1) return short(dates[0], true);
  const consecutive = consecutiveRuns(dates).length === 1;
  if (consecutive) return `Du ${short(dates[0])} au ${short(dates[dates.length - 1])} · ${dates.length} jours`;
  const shown = dates.slice(0, 4).map((d) => short(d, true));
  return `${dates.length} jours : ${shown.join(", ")}${dates.length > 4 ? "…" : ""}`;
}
