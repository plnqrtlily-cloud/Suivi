"use client";

import { CycleEstimate, CyclePhase } from "@/lib/cycle-types";

// Deuxième style d'affichage du cycle, alternatif à la roue circulaire :
// une frise linéaire compacte, plus lisible d'un coup d'œil sur mobile et
// pour un coach qui compare plusieurs athlètes à la suite (cf. demande :
// proposer plusieurs types d'affichage).

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstruelle: "#E8896A",
  folliculaire: "#1B4B4F",
  ovulatoire: "#7C5C46",
  lutéale: "#6B7A8A",
  inconnue: "#D5DBDA",
};

function buildSegments(cycleLength: number, periodLength: number): { phase: CyclePhase; start: number; end: number }[] {
  const ovulationCenter = cycleLength / 2;
  return [
    { phase: "menstruelle", start: 0, end: periodLength },
    { phase: "folliculaire", start: periodLength, end: ovulationCenter - 2 },
    { phase: "ovulatoire", start: ovulationCenter - 2, end: ovulationCenter + 2 },
    { phase: "lutéale", start: ovulationCenter + 2, end: cycleLength },
  ];
}

export function CycleTimeline({
  estimate,
  cycleLength,
  periodLength,
}: {
  estimate: CycleEstimate;
  cycleLength: number;
  periodLength: number;
}) {
  const segments = buildSegments(cycleLength, periodLength);
  const dayOfCycle = estimate.dayOfCycle ?? 0;
  const markerPct = Math.min(100, (dayOfCycle / cycleLength) * 100);

  return (
    <div>
      <div className="relative h-5 overflow-hidden rounded-full">
        <div className="flex h-full w-full">
          {segments.map((s) => (
            <div
              key={s.phase}
              style={{ width: `${((s.end - s.start) / cycleLength) * 100}%`, backgroundColor: PHASE_COLORS[s.phase] }}
            />
          ))}
        </div>
        {estimate.dayOfCycle !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.35)]"
            style={{ left: `${markerPct}%` }}
            title={`Jour ${dayOfCycle}`}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate">
        <span>Jour 1</span>
        <span>Jour {cycleLength}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {(["menstruelle", "folliculaire", "ovulatoire", "lutéale"] as CyclePhase[]).map((p) => (
          <span key={p} className="flex items-center gap-1.5 text-ink-soft">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_COLORS[p] }} />
            {p === "lutéale" ? "Lutéale" : p.charAt(0).toUpperCase() + p.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
