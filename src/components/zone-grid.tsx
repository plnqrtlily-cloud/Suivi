// Progression du froid (effort léger) vers le chaud (effort maximal) — même
// code couleur pour les trois types de zones, pour qu'une zone 4 se lise
// pareil qu'on parle de fréquence cardiaque, de puissance ou d'allure.
export const ZONE_COLORS: Record<number, string> = {
  1: "#6B7A8A",
  2: "#1B4B4F",
  3: "#B08A3E",
  4: "#E8896A",
  5: "#B85A3E",
};

export interface ZoneRow {
  zone: number;
  label: string;
  range: string;
}

export function ZoneGrid({ zones }: { zones: ZoneRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {zones.map((z) => {
        const color = ZONE_COLORS[z.zone];
        return (
          <div key={z.zone} className="overflow-hidden rounded-xl bg-paper-dim text-center">
            <div className="h-1.5" style={{ backgroundColor: color }} />
            <div className="p-2.5">
              <span
                className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {z.zone}
              </span>
              <p className="text-sm font-semibold text-ink">{z.range}</p>
              <p className="mt-0.5 text-[10.5px] leading-tight text-slate">{z.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Formatte une allure décimale (min/km) en "4:30" — 4.5 min/km = 4 min 30 s.
export function formatPaceValue(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
