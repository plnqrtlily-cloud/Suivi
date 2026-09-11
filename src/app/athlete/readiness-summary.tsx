"use client";

import { useState } from "react";
import { ReadinessGauge } from "@/components/readiness-gauge";
import { DailyCheckin } from "./daily-checkin";
import { computeGlobalScore, computeHooperIndex, scoreLabel, Checkin } from "@/lib/checkin-types";

// Carte "Forme du jour" simplifiée pour l'accueil : jauge + score + statut
// uniquement. Les 5 sous-scores ne sont visibles qu'en cliquant, pour ne pas
// surcharger la page d'accueil.
export function ReadinessSummary({ date, checkin }: { date: string; checkin: Checkin }) {
  const [expanded, setExpanded] = useState(false);
  const score = computeGlobalScore(checkin);
  const hooper = computeHooperIndex(checkin);

  return (
    <div className="overflow-hidden rounded-3xl bg-ink text-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-col gap-4 p-5 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Forme du jour</span>
          <svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>
        <div className="flex items-center gap-4">
          <ReadinessGauge score={score} />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[15px] font-semibold" style={{ color: "#E8896A" }}>
              {scoreLabel(score)}
            </p>
            <p className="text-xs text-white/55">Indice Hooper : {hooper}/50</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="rounded-t-3xl bg-white p-5 text-ink">
          <p className="mb-3 text-xs text-slate">Modifie ta forme du jour si besoin.</p>
          <DailyCheckin date={date} existing={checkin} compact />
        </div>
      )}
    </div>
  );
}
