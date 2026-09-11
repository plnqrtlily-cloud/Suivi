"use client";

import { CycleEstimate, CyclePhase } from "@/lib/cycle-types";

// Roue circulaire façon Clue/Flo : un anneau divisé en 4 arcs colorés (un par phase),
// avec un repère qui indique le jour actuel sur l'anneau, et le détail au centre.
// Choisi plutôt qu'une simple frise linéaire car c'est le format le plus reconnu et
// le plus intuitif dans les meilleures apps de suivi de cycle du marché (cf. étude
// de marché : Wild.AI, FitrWoman, et plus largement Clue/Flo).

// Repris de la palette du produit (globals.css) plutôt que de couleurs "cycle"
// génériques — aucune de ces teintes n'est un rouge alarmant.
const PHASE_COLORS: Record<CyclePhase, string> = {
  menstruelle: "#E8896A", // corail (--color-gold-light)
  folliculaire: "#1B4B4F", // pétrole (--color-moss)
  ovulatoire: "#7C5C46", // argile (--color-clay)
  lutéale: "#6B7A8A", // ardoise bleutée (--color-status-postponed)
  inconnue: "#D5DBDA", // --color-line
};

interface PhaseSegment {
  phase: CyclePhase;
  startDay: number; // jour de début (0-indexé)
  endDay: number; // jour de fin (exclusif)
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function buildSegments(cycleLength: number, periodLength: number): PhaseSegment[] {
  const ovulationCenter = cycleLength / 2;
  return [
    { phase: "menstruelle", startDay: 0, endDay: periodLength },
    { phase: "folliculaire", startDay: periodLength, endDay: ovulationCenter - 2 },
    { phase: "ovulatoire", startDay: ovulationCenter - 2, endDay: ovulationCenter + 2 },
    { phase: "lutéale", startDay: ovulationCenter + 2, endDay: cycleLength },
  ];
}

export function CycleWheel({
  estimate,
  cycleLength,
  periodLength,
}: {
  estimate: CycleEstimate;
  cycleLength: number;
  periodLength: number;
}) {
  const segments = buildSegments(cycleLength, periodLength);
  const cx = 100;
  const cy = 100;
  const r = 78;
  const strokeWidth = 26;

  const currentDay = estimate.dayOfCycle ? estimate.dayOfCycle - 1 : null; // 0-indexé pour le calcul d'angle
  const markerAngle = currentDay !== null ? (currentDay / cycleLength) * 360 : null;
  const markerPos = markerAngle !== null ? polarToCartesian(cx, cy, r, markerAngle) : null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative h-48 w-48 shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          {segments.map((seg) => (
            <path
              key={seg.phase}
              d={describeArc(cx, cy, r, (seg.startDay / cycleLength) * 360, (seg.endDay / cycleLength) * 360)}
              stroke={PHASE_COLORS[seg.phase]}
              strokeWidth={strokeWidth}
              fill="none"
              opacity={estimate.phase === seg.phase ? 1 : 0.35}
            />
          ))}
          {markerPos && (
            <circle cx={markerPos.x} cy={markerPos.y} r={7} fill="#182220" stroke="white" strokeWidth={2} />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {estimate.dayOfCycle ? (
            <>
              <p className="text-xs text-slate">Jour</p>
              <p className="font-display text-3xl text-ink">{estimate.dayOfCycle}</p>
              <p className="text-xs font-medium" style={{ color: PHASE_COLORS[estimate.phase] }}>
                {estimate.phase !== "inconnue" ? estimate.phase : "—"}
              </p>
            </>
          ) : (
            <p className="px-6 text-xs text-slate">Renseignez une date de règles pour activer la roue</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        {segments.map((seg) => (
          <div key={seg.phase} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS[seg.phase] }} />
            <span className={estimate.phase === seg.phase ? "font-medium text-ink" : "text-slate"}>
              {seg.phase.charAt(0).toUpperCase() + seg.phase.slice(1)}
            </span>
            <span className="text-slate">
              (j.{seg.startDay + 1}–{Math.round(seg.endDay)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
