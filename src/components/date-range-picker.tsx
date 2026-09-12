"use client";

import { useState } from "react";
import { getMonthGrid, monthLabel, toISODate } from "@/lib/dates";

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

// Sélecteur de plage de dates façon Booking.com : premier clic pose le début,
// survol prévisualise la plage, second clic pose la fin (l'ordre des deux
// clics n'a pas d'importance, la plage est toujours normalisée du plus tôt au
// plus tard) ; un troisième clic repart sur une nouvelle sélection à un seul
// jour. Permet de fixer une même séance sur plusieurs jours d'un coup plutôt
// qu'un jour à la fois.
export function DateRangePicker({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (range: { start: string; end: string }) => void;
}) {
  const initial = start ? new Date(`${start}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth() + 1);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  // Un simple `start`/`end` égaux ne suffit pas à distinguer "un seul jour
  // cliqué, en attente du second clic" de "plage d'un jour confirmée" — d'où
  // ce drapeau local pour savoir quel comportement adopter au clic suivant.
  const [awaitingEnd, setAwaitingEnd] = useState(false);

  const grid = getMonthGrid(viewYear, viewMonth);

  function prevMonth() {
    const d = new Date(viewYear, viewMonth - 2, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  }
  function nextMonth() {
    const d = new Date(viewYear, viewMonth, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  }

  function handleClick(date: string) {
    if (!awaitingEnd || !start) {
      setAwaitingEnd(true);
      onChange({ start: date, end: date });
    } else {
      setAwaitingEnd(false);
      onChange(date < start ? { start: date, end: start } : { start, end: date });
    }
  }

  // Plage effectivement affichée : la sélection confirmée, ou un aperçu entre
  // le début posé et le jour survolé tant que le second clic n'a pas eu lieu.
  const previewEnd = start && awaitingEnd && hoverDate ? hoverDate : end;
  const rangeStart = start && previewEnd ? (start < previewEnd ? start : previewEnd) : start;
  const rangeEnd = start && previewEnd ? (start < previewEnd ? previewEnd : start) : null;

  const formatted =
    start && end
      ? start === end
        ? new Date(`${start}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
        : `Du ${new Date(`${start}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${new Date(
            `${end}T00:00:00`
          ).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — ${
            Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1
          } jours`
      : "Sélectionnez un ou plusieurs jours";

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </button>
        <p className="text-sm font-semibold capitalize text-ink-soft">{monthLabel(viewYear, viewMonth)}</p>
        <button type="button" onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
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

      <div className="grid grid-cols-7">
        {grid.map((cell) => {
          const inRange = !!(rangeStart && rangeEnd && cell.date >= rangeStart && cell.date <= rangeEnd);
          const isEdge = cell.date === rangeStart || cell.date === rangeEnd;
          const isRangeLeftEnd = cell.date === rangeStart;
          const isRangeRightEnd = cell.date === rangeEnd;

          return (
            <button
              key={cell.date}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => handleClick(cell.date)}
              onMouseEnter={() => setHoverDate(cell.date)}
              onMouseLeave={() => setHoverDate(null)}
              className="relative flex h-9 items-center justify-center py-0.5"
            >
              {inRange && (
                <span
                  className={`absolute inset-y-1 left-0 right-0 bg-gold-light/10 ${
                    isRangeLeftEnd ? "rounded-l-full" : ""
                  } ${isRangeRightEnd ? "rounded-r-full" : ""}`}
                />
              )}
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                  isEdge ? "bg-gold-light text-white" : cell.inMonth ? "text-ink" : "text-line"
                }`}
              >
                {cell.day}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 border-t border-line pt-3 text-center text-[13px] font-semibold text-ink-soft first-letter:capitalize">{formatted}</p>
    </div>
  );
}

export function dateRangeToList(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
