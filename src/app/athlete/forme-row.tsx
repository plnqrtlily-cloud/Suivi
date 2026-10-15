"use client";

import { useState } from "react";
import { DailyCheckin } from "./daily-checkin";
import { computeGlobalScore, scoreLabel, type Checkin } from "@/lib/checkin-types";

// Forme du jour en une ligne : anneau + libellé + deux repères. Un toucher
// déplie le formulaire pour la renseigner ou la corriger.
export function FormeRow({ date, checkin }: { date: string; checkin?: Checkin }) {
  const [open, setOpen] = useState(false);
  const score = checkin ? computeGlobalScore(checkin) : null;
  const pct = score != null ? Math.max(0, Math.min(1, score / 10)) : 0;
  const C = 2 * Math.PI * 18;

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        {score != null ? (
          <span className="relative flex flex-shrink-0">
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#e6eae9" strokeWidth="5" />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="#e8896a"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${(pct * C).toFixed(1)} ${C.toFixed(1)}`}
                transform="rotate(-90 22 22)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-ink">{score.toFixed(1).replace(".", ",")}</span>
          </span>
        ) : (
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#e8896a] text-lg font-bold text-white">?</span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-slate">Forme du jour</span>
          <b className="text-[15px] text-ink">{score != null ? scoreLabel(score) : "Comment tu te sens ?"}</b>
        </span>
        {checkin ? (
          <span className="text-[13px] text-slate">
            Sommeil {checkin.sleep_quality} · Stress {checkin.stress}
          </span>
        ) : (
          <span className="text-sm font-bold text-[#a4492a]">Noter</span>
        )}
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#5b6660" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-90" : ""}`}>
          <path d="M8 5l5 5-5 5" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-paper-dim px-4 pb-4 pt-3">
          <DailyCheckin date={date} existing={checkin} compact />
        </div>
      )}
    </div>
  );
}
