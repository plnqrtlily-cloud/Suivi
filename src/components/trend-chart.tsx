"use client";

export interface TrendPoint {
  value: number;
  recorded_at: string;
}

// Graphique de tendance simple (ligne + points), partagé entre les
// statistiques de performance et les charges de référence — même lecture
// visuelle des deux côtés plutôt que deux implémentations qui divergent.
export function TrendChart({ series, unit }: { series: TrendPoint[]; unit?: string }) {
  const width = 600;
  const height = 160;
  const padX = 12;
  const padTop = 16;
  const padBottom = 28;

  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = series.map((p, i) => {
    const x = padX + (i / (series.length - 1)) * (width - padX * 2);
    const y = padTop + (1 - (p.value - min) / range) * (height - padTop - padBottom);
    return { x, y, ...p };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 180 }}>
        <path d={path} fill="none" stroke="#1B4B4F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#1B4B4F" />
        ))}
        {points.length > 0 && (
          <>
            <text x={points[0].x} y={height - 8} fontSize="11" fill="#5B6660" textAnchor="start">
              {points[0].recorded_at.slice(0, 10)}
            </text>
            <text x={points[points.length - 1].x} y={height - 8} fontSize="11" fill="#5B6660" textAnchor="end">
              {points[points.length - 1].recorded_at.slice(0, 10)}
            </text>
          </>
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-slate">
        <span>
          Premier relevé : <span className="font-medium text-ink">{values[0]}{unit ? ` ${unit}` : ""}</span>
        </span>
        <span>
          Dernier relevé : <span className="font-medium text-ink">{values[values.length - 1]}{unit ? ` ${unit}` : ""}</span>
        </span>
      </div>
    </div>
  );
}
