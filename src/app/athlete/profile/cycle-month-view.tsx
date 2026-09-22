"use client";

import { useEffect, useRef, useState } from "react";
import { CycleEstimate, CyclePhase } from "@/lib/cycle-types";

// Troisième style d'affichage : un mini calendrier du mois, chaque jour coloré
// selon la phase estimée — utile pour se projeter ("qu'est-ce qui m'attend dans
// 10 jours ?") plutôt que voir seulement l'état du jour même, ce que ni la roue
// ni la frise ne montrent aussi clairement.

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstruelle: "#E8896A",
  folliculaire: "#1B4B4F",
  ovulatoire: "#7C5C46",
  lutéale: "#6B7A8A",
  inconnue: "#D5DBDA",
};

const PANE_HEIGHT = 300; // hauteur d'un mois : en-têtes + 6 rangées au plus

function phaseForDay(dayOfCycle: number, cycleLength: number, periodLength: number): CyclePhase {
  const d = ((dayOfCycle % cycleLength) + cycleLength) % cycleLength;
  const ovulationCenter = cycleLength / 2;
  if (d < periodLength) return "menstruelle";
  if (d < ovulationCenter - 2) return "folliculaire";
  if (d < ovulationCenter + 2) return "ovulatoire";
  return "lutéale";
}

/** Écart en jours entre deux dates, calculé en UTC pour ignorer les changements d'heure. */
function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

function MonthGrid({
  monthOffset,
  estimate,
  cycleLength,
  periodLength,
}: {
  monthOffset: number;
  estimate: CycleEstimate;
  cycleLength: number;
  periodLength: number;
}) {
  const today = new Date();
  const anchor = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lundi = 0 (plutôt que dimanche = 0, convention US par défaut de getDay()).
  const firstWeekday = (anchor.getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <p className="mb-2 text-center text-sm font-medium capitalize text-ink">
        {anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((dayNum, i) => {
          if (dayNum === null) return <div key={i} />;
          const cellDate = new Date(year, month, dayNum);
          // L'écart se compte en jours réels et non en numéro de jour du mois :
          // sinon la projection se brisait dès qu'on quittait le mois courant.
          const dayOfCycle = (estimate.dayOfCycle as number) + daysBetween(today, cellDate);
          const phase = phaseForDay(dayOfCycle, cycleLength, periodLength);
          const isToday = daysBetween(today, cellDate) === 0;
          return (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-full text-[11px] font-medium text-white ${
                isToday ? "ring-2 ring-ink ring-offset-1" : ""
              }`}
              style={{ backgroundColor: PHASE_COLORS[phase] }}
              title={phase}
            >
              {dayNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Défilement continu : le mois précédent, le mois courant et le suivant sont
 * empilés dans un conteneur à scroll natif, aligné par scroll-snap. Quand le
 * geste se stabilise sur un voisin, on décale l'ancre et on recentre — le
 * défilement paraît infini. Même principe que le calendrier d'entraînement,
 * mais sans passer par l'URL : tout se joue en état local.
 */
function ContinuousMonths(props: {
  estimate: CycleEstimate;
  cycleLength: number;
  periodLength: number;
}) {
  const [offset, setOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recentrage sur le panneau du milieu à chaque changement d'ancre, y compris
  // au montage. Instantané, donc invisible.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.clientHeight;
  }, [offset]);

  function handleScroll() {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const unit = el.clientHeight;
      if (!unit) return;
      const center = el.scrollTop + unit / 2;
      if (center < unit) setOffset((o) => o - 1);
      else if (center > unit * 2) setOffset((o) => o + 1);
    }, 100);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: PANE_HEIGHT }}
      className="snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {[offset - 1, offset, offset + 1].map((o) => (
        <div key={o} style={{ height: PANE_HEIGHT }} className="snap-start">
          <MonthGrid monthOffset={o} {...props} />
        </div>
      ))}
    </div>
  );
}

export function CycleMonthView({
  estimate,
  cycleLength,
  periodLength,
}: {
  estimate: CycleEstimate;
  cycleLength: number;
  periodLength: number;
}) {
  // Le défilement continu capture la molette sur la zone du calendrier ; il
  // reste donc optionnel, et désactivé par défaut pour ne rien changer à qui
  // ne le demande pas.
  const [continuous, setContinuous] = useState(false);
  const [offset, setOffset] = useState(0);

  if (estimate.dayOfCycle === null) {
    return <p className="text-sm text-slate">Renseignez une date de début de règles pour voir le calendrier.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate">
          <input
            type="checkbox"
            checked={continuous}
            onChange={(e) => {
              setContinuous(e.target.checked);
              setOffset(0);
            }}
            className="h-3.5 w-3.5 accent-moss"
          />
          Défilement continu
        </label>
        {!continuous && (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Mois précédent"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Mois suivant"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink"
            >
              ›
            </button>
          </span>
        )}
      </div>

      {continuous ? (
        <ContinuousMonths estimate={estimate} cycleLength={cycleLength} periodLength={periodLength} />
      ) : (
        <MonthGrid monthOffset={offset} estimate={estimate} cycleLength={cycleLength} periodLength={periodLength} />
      )}

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
