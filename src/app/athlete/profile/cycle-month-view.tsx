"use client";

import { CycleEstimate, CyclePhase } from "@/lib/cycle-types";

// Troisième style d'affichage : un mini calendrier du mois en cours, chaque
// jour coloré selon la phase estimée — utile pour se projeter ("qu'est-ce qui
// m'attend dans 10 jours ?") plutôt que voir seulement l'état du jour même,
// ce que ni la roue ni la frise ne montrent aussi clairement.

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstruelle: "#E8896A",
  folliculaire: "#1B4B4F",
  ovulatoire: "#7C5C46",
  lutéale: "#6B7A8A",
  inconnue: "#D5DBDA",
};

function phaseForDay(dayOfCycle: number, cycleLength: number, periodLength: number): CyclePhase {
  const d = ((dayOfCycle % cycleLength) + cycleLength) % cycleLength;
  const ovulationCenter = cycleLength / 2;
  if (d < periodLength) return "menstruelle";
  if (d < ovulationCenter - 2) return "folliculaire";
  if (d < ovulationCenter + 2) return "ovulatoire";
  return "lutéale";
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
  if (estimate.dayOfCycle === null) {
    return <p className="text-sm text-slate">Renseignez une date de début de règles pour voir le calendrier.</p>;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lundi = 0 (plutôt que dimanche = 0, convention US par défaut de getDay()).
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const todayDayOfMonth = today.getDate();

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <p className="mb-2 text-center text-sm font-medium text-ink">
        {today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((dayNum, i) => {
          if (dayNum === null) return <div key={i} />;
          const offsetFromToday = dayNum - todayDayOfMonth;
          const dayOfCycle = (estimate.dayOfCycle as number) + offsetFromToday;
          const phase = phaseForDay(dayOfCycle, cycleLength, periodLength);
          const isToday = dayNum === todayDayOfMonth;
          return (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-full text-[11px] font-medium text-white ${
                isToday ? "ring-2 ring-offset-1 ring-ink" : ""
              }`}
              style={{ backgroundColor: PHASE_COLORS[phase] }}
              title={phase}
            >
              {dayNum}
            </div>
          );
        })}
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
