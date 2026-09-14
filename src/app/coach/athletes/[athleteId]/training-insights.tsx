import { sportLabel } from "@/components/ui";
import type { Workout, ImportedActivity } from "@/lib/queries";
import { computeWeeklyLoad, computeRpeEvolution, computeSportDistribution, computeSportSummaries, computePeriodSummary } from "@/lib/training-stats";
import { todayISO } from "@/lib/dates";
import { SPORT_ICON_PATHS } from "@/lib/sport-icons";

const SPORT_COLORS: Record<string, string> = {
  running: "#1B4B4F",
  cycling: "#E8896A",
  hiking: "#7C5C46",
  swimming: "#6B7A8A",
  climbing: "#0F3336",
  strength: "#B85A3E",
  other: "#9AA39C",
};
function sportColor(sport: string): string {
  return SPORT_COLORS[sport] || "#9AA39C";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function SportDonut({ distribution }: { distribution: { sport: string; count: number }[] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <p className="text-sm text-slate">Pas encore de séance enregistrée.</p>;

  let cursor = 0;
  const cx = 60;
  const cy = 60;
  const r = 46;

  return (
    <div className="flex items-center gap-5">
      <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
        {distribution.map((d) => {
          const angle = (d.count / total) * 359.999; // 360 pile ferme le cercle et casse le tracé d'arc
          const path = describeArc(cx, cy, r, cursor, cursor + angle);
          cursor += angle;
          return <path key={d.sport} d={path} stroke={sportColor(d.sport)} strokeWidth={16} fill="none" />;
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="600" fill="#182220" fontFamily="Fraunces, Georgia, serif">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#5B6660">
          séances
        </text>
      </svg>
      <div className="flex flex-1 flex-col gap-1.5">
        {distribution.map((d) => (
          <div key={d.sport} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: sportColor(d.sport) }} />
            <span className="flex-1 text-ink-soft">{sportLabel(d.sport)}</span>
            <span className="font-semibold text-ink">{Math.round((d.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyLoadChart({ points }: { points: { weekStart: string; load: number }[] }) {
  const max = Math.max(...points.map((p) => p.load), 1);
  const chartHeight = 96; // px — une hauteur de pourcentage n'a rien à résoudre tant que le
  // parent flex (items-end, donc non "stretch") n'a pas de hauteur propre : on calcule
  // les barres directement en pixels plutôt que de dépendre d'un pourcentage silencieusement ignoré.
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: chartHeight }}>
        {points.map((p) => (
          <div key={p.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: chartHeight }}>
            <div
              className="w-full rounded-t-md bg-moss/70"
              style={{ height: Math.max((p.load / max) * chartHeight, p.load > 0 ? 4 : 0) }}
              title={`${p.load} u.a.`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {points.map((p) => (
          <span key={p.weekStart} className="flex-1 text-center text-[9px] text-slate">
            {new Date(`${p.weekStart}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" })}
          </span>
        ))}
      </div>
    </div>
  );
}

function RpeTrend({ points }: { points: { date: string; rpe: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-slate">Pas encore assez de RPE renseignés pour une tendance.</p>;

  const width = 400;
  const height = 90;
  const padX = 8;
  const padTop = 10;
  const padBottom = 18;

  const coords = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * (width - padX * 2),
    y: padTop + (1 - (p.rpe - 1) / 9) * (height - padTop - padBottom),
    ...p,
  }));
  const path = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <path d={path} fill="none" stroke="#E8896A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#E8896A" />
      ))}
      <text x={coords[0].x} y={height - 4} fontSize="10" fill="#5B6660">
        {new Date(`${coords[0].date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
      </text>
      <text x={coords[coords.length - 1].x} y={height - 4} fontSize="10" fill="#5B6660" textAnchor="end">
        {new Date(`${coords[coords.length - 1].date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
      </text>
    </svg>
  );
}

function SportSummaryCard({ s }: { s: ReturnType<typeof computeSportSummaries>[number] }) {
  const hours = Math.floor(s.totalMinutes / 60);
  const mins = s.totalMinutes % 60;
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${sportColor(s.sport)}1A`, color: sportColor(s.sport) }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={SPORT_ICON_PATHS[s.sport] || "M10 2v16M2 10h16"} />
          </svg>
        </span>
        <span className="text-sm font-semibold text-ink">{sportLabel(s.sport)}</span>
        <span className="ml-auto text-xs text-slate">{s.count} séance{s.count > 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span>
          <b className="text-ink">{hours > 0 ? `${hours}h${mins.toString().padStart(2, "0")}` : `${mins} min`}</b> total
        </span>
        {s.totalDistanceKm !== null && (
          <span>
            <b className="text-ink">{s.totalDistanceKm} km</b>
          </span>
        )}
        {s.totalElevationM !== null && (
          <span>
            <b className="text-ink">{s.totalElevationM} m</b> D+
          </span>
        )}
        {s.avgPowerW !== null && (
          <span>
            <b className="text-ink">{s.avgPowerW} W</b> moy.
          </span>
        )}
        {s.avgRpe !== null && (
          <span>
            <b className="text-ink">RPE {s.avgRpe}</b> moy.
          </span>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-paper-dim p-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate">{sub}</p>}
    </div>
  );
}

function PeriodSummaryRow({ summary }: { summary: ReturnType<typeof computePeriodSummary> }) {
  const hours = Math.floor(summary.avgWeeklyMinutes / 60);
  const mins = summary.avgWeeklyMinutes % 60;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Volume hebdo moyen" value={hours > 0 ? `${hours}h${mins.toString().padStart(2, "0")}` : `${mins} min`} />
      <StatTile
        label="Adhérence"
        value={summary.adherenceRate !== null ? `${summary.adherenceRate}%` : "—"}
        sub={summary.totalSessions > 0 ? `${summary.completedSessions}/${summary.totalSessions} séances` : "Aucune séance passée"}
      />
      <StatTile label="Charge totale" value={`${summary.totalLoad}`} sub="u.a." />
      <StatTile label="Distance totale" value={summary.totalDistanceKm !== null ? `${summary.totalDistanceKm} km` : "—"} />
    </div>
  );
}

export function TrainingInsights({ workouts, imports, periodDays }: { workouts: Workout[]; imports: ImportedActivity[]; periodDays: number }) {
  const weeklyLoad = computeWeeklyLoad(workouts, imports, Math.max(1, Math.ceil(periodDays / 7)));
  const rpeEvolution = computeRpeEvolution(workouts, imports, 15);
  const distribution = computeSportDistribution(workouts, imports);
  const summaries = computeSportSummaries(workouts, imports).slice(0, 4);
  const periodSummary = computePeriodSummary(workouts, imports, periodDays, todayISO());

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-line bg-white p-4 md:col-span-2">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">L&apos;essentiel</h3>
        <PeriodSummaryRow summary={periodSummary} />
      </div>

      <div className="rounded-3xl border border-line bg-white p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Répartition par sport</h3>
        <SportDonut distribution={distribution} />
      </div>

      <div className="rounded-3xl border border-line bg-white p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Charge hebdomadaire (u.a.)</h3>
        <WeeklyLoadChart points={weeklyLoad} />
      </div>

      <div className="rounded-3xl border border-line bg-white p-4 md:col-span-2">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Évolution du RPE</h3>
        <RpeTrend points={rpeEvolution} />
      </div>

      {summaries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
          {summaries.map((s) => (
            <SportSummaryCard key={s.sport} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
