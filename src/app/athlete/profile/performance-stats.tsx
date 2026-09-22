"use client";

import { useState } from "react";
import { TrendChart } from "@/components/trend-chart";

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
  // Avec la liste d'indicateurs disponibles (plusieurs dizaines, toutes
  // disciplines confondues), afficher une case pour chacun — y compris ceux
  // jamais renseignés — noierait les quelques mesures qui comptent vraiment
  // sous des cases grisées. Seuls les indicateurs déjà mesurés apparaissent
  // ici ; les autres restent sélectionnables dans le formulaire d'ajout.
  const measured = metrics.filter((m) => !!latest[m.value]);

  return (
    <div className="mb-5">
      {measured.length === 0 ? (
        <p className="text-sm text-slate">Aucune mesure enregistrée pour l&apos;instant.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {measured.map((m) => {
            const isSelected = selected === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setSelected(isSelected ? null : m.value)}
                className={`cursor-pointer rounded-2xl border px-3 py-2 text-left transition-colors hover:border-moss ${
                  isSelected ? "border-moss bg-moss/5" : "border-line bg-white"
                }`}
              >
                <dt className="text-slate">{m.label}</dt>
                <dd className="font-medium text-ink">{latest[m.value]?.value ?? "—"}</dd>
              </button>
            );
          })}
        </dl>
      )}

      {selected && selectedDef && (
        <div className="mt-3 rounded-2xl border border-line bg-white p-4">
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

