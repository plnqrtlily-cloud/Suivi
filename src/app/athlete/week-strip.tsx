"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type StripMark = "done" | "missed" | "planned" | "goal" | null;

export interface StripDay {
  date: string;
  week: number; // décalage de semaine (0 = semaine en cours)
  mark: StripMark;
}

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const PET = "#1b4b4f";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Bande des jours à défilement natif, fluide et continu : tous les jours de
 * plusieurs mois sont posés côte à côte, le navigateur gère l'inertie, et
 * l'aimantation se fait jour par jour (jamais de rechargement pendant le
 * geste). Toucher un jour l'ouvre.
 */
export function WeekStrip({ days, selectedDate, today, anchorDate }: { days: StripDay[]; selectedDate: string; today: string; anchorDate: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const firstDate = days[0]?.date;

  // Au montage (ou si la plage change) : se poser, sans animation, sur le
  // lundi de la semaine affichée.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const i = days.findIndex((d) => d.date === anchorDate);
    el.scrollLeft = Math.max(0, i) * (el.clientWidth / 7);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDate]);

  // Jour choisi hors de la zone visible (ex. retour à aujourd'hui) : on y
  // glisse en douceur.
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const unit = el.clientWidth / 7;
    const i = days.findIndex((d) => d.date === anchorDate);
    const left = i * unit;
    const sel = days.findIndex((d) => d.date === selectedDate);
    const selLeft = sel * unit;
    if (selLeft < el.scrollLeft - 1 || selLeft > el.scrollLeft + el.clientWidth - unit + 1) {
      el.scrollTo({ left: left, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, selectedDate]);

  return (
    <div
      ref={ref}
      className={`flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      {days.map((d, idx) => {
        const isSel = d.date === selectedDate;
        const dow = idx % 7;
        const day = Number(d.date.slice(8, 10));
        return (
          <Link
            key={d.date}
            href={`/athlete?week=${d.week}&day=${d.date}`}
            scroll={false}
            aria-current={isSel ? "date" : undefined}
            aria-label={new Date(`${d.date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            className="flex w-[calc(100%/7)] flex-shrink-0 snap-start flex-col items-center gap-1"
          >
            <span className="text-[11px] font-semibold text-slate">{day === 1 ? monthShort(d.date) : DAY_LETTERS[dow]}</span>
            <span
              className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px] font-bold ${
                isSel ? "bg-[#1b4b4f] text-white" : d.date === today ? "text-[#1b4b4f] ring-2 ring-[#1b4b4f]/30" : "text-ink"
              }`}
            >
              {day}
            </span>
            <span className="flex h-[11px] items-center">
              {d.mark === "done" ? (
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke={PET} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="fait">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                </svg>
              ) : d.mark ? (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: d.mark === "missed" ? "#e8896a" : d.mark === "goal" ? "#c9a227" : "#9fc3c4" }}
                />
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function monthShort(date: string) {
  return MONTHS[Number(date.slice(5, 7)) - 1];
}
