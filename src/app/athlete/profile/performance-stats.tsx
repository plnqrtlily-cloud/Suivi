"use client";

import { useState } from "react";

export interface MetricDef {
  value: string;
  label: string;
}

export interface MeasurementPoint {
  value: number;
  recorded_at: string;
}

// Bloc "Statistiques de performance" : chaque indicateur est cliquable et fait
// apparaître un graphique de tendance (évolution depuis le premier enregistrement).
export function PerformanceStats({
  metrics,
  latest,
  seriesByMetric,
}: {
  metrics: MetricDef[];
  latest: Record<string, { value: number; recorded_at: string } | undefined>;
  seriesByMetric: Record<string, MeasurementPoint[]>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedDef = metrics.find((m) => m.value === selected);
  const selectedSeries = selected ? seriesByMetric[selected] || [] : [];

  return (
    <div className="mb-5">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {metrics.map((m) => {
          const hasData = !!latest[m.value];
          const isSelected = selected === m.value;
          return (
            <button
              key={m.value}
              type="button"
              disabled={!hasData}
              onClick={() => setSelected(isSelected ? null : m.value)}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                isSelected ? "border-moss bg-moss/5" : "border-line bg-white"
              } ${hasData ? "cursor-pointer hover:border-moss" : "cursor-default opacity-60"}`}
            >
              <dt className="text-slate">{m.label}</dt>
              <dd className="font-medium text-ink">{latest[m.value]?.value ?? "—"}</dd>
            </button>
          );
        })}
      </dl>

      {selected && selectedDef && (
        <div className="mt-3 rounded-md border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">Évolution — {selectedDef.label}</h3>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-slate hover:text-ink">
              Fermer
            </button>
          </div>
          {selectedSeries.length < 2 ? (
            <p className="text-sm text-slate">Pas encore assez de mesures pour tracer une tendance.</p>
          ) : (
            <TrendChart series={selectedSeries} />
          )}
        </div>
      )}
    </div>
  );
}

function TrendChart({ series }: { series: MeasurementPoint[] }) {
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
        <path d={path} fill="none" stroke="#1E6B4F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#1E6B4F" />
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
          Premier relevé : <span className="font-medium text-ink">{values[0]}</span>
        </span>
        <span>
          Dernier relevé : <span className="font-medium text-ink">{values[values.length - 1]}</span>
        </span>
      </div>
    </div>
  );
}
