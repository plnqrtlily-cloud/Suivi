"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMeasurementAction, deleteMeasurementAction } from "@/lib/actions";
import { MEASUREMENT_DEVICES, deviceLabel, groupMetrics } from "@/lib/performance-metrics";
import type { AthleteMeasurement } from "@/lib/queries";

interface MetricOption {
  value: string;
  label: string;
  group?: string;
}

// Historique éditable des mesures : la seule vue jusqu'ici était figée (ajout
// uniquement), une erreur de saisie — mauvaise date, mauvais indicateur,
// virgule en trop sur la valeur — restait donc gravée sans recours.
export function MeasurementsHistory({
  athleteId,
  history,
  metrics,
}: {
  athleteId: string;
  history: AthleteMeasurement[];
  metrics: MetricOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Copie locale retirée optimistiquement à la suppression, même pattern que
  // CoachReminders : attendre le router.refresh() pour faire disparaître la
  // ligne donnait l'impression que le clic n'avait rien fait.
  const [items, setItems] = useState(history);
  useEffect(() => setItems(history), [history]);

  const visible = showAll ? items : items.slice(0, 10);

  async function handleSave(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    await updateMeasurementAction(id, athleteId, formData);
    setPending(false);
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette mesure ?")) return;
    setItems((prev) => prev.filter((h) => h.id !== id));
    await deleteMeasurementAction(id, athleteId);
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate">Aucune mesure pour l&apos;instant.</p>;
  }

  return (
    <div>
      <ul className="space-y-1.5 text-sm">
        {visible.map((h) => {
          const label = metrics.find((m) => m.value === h.metric)?.label || h.metric;
          if (editingId === h.id) {
            return (
              <li key={h.id} className="rounded-xl border border-line bg-white p-3">
                <form onSubmit={(e) => handleSave(e, h.id)} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-ink-soft">Indicateur</span>
                    <select
                      name="metric"
                      defaultValue={h.metric}
                      required
                      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                    >
                      {groupMetrics(metrics).map(({ group, items }) => (
                        <optgroup key={group} label={group}>
                          {items.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-ink-soft">Valeur</span>
                    <input
                      type="number"
                      step="0.1"
                      name="value"
                      defaultValue={h.value}
                      required
                      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-ink-soft">Date de la mesure</span>
                    <input
                      type="date"
                      name="recordedAt"
                      defaultValue={h.recorded_at.slice(0, 10)}
                      required
                      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-ink-soft">Appareil utilisé</span>
                    <select
                      name="device"
                      defaultValue={h.device || ""}
                      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                    >
                      {MEASUREMENT_DEVICES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium text-ink-soft">Note (facultatif)</span>
                    <input
                      name="note"
                      defaultValue={h.note || ""}
                      placeholder="Contexte de la mesure…"
                      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                    />
                  </label>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-moss-dark disabled:opacity-50"
                    >
                      {pending ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={pending}
                      className="text-sm text-ink-soft hover:text-ink"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </li>
            );
          }
          return (
            <li key={h.id} className="flex items-start justify-between gap-2 rounded-xl bg-paper-dim p-2">
              <span className="text-ink">
                {h.recorded_at.slice(0, 10)} — <b className="font-semibold">{label}</b> : {h.value}
                {h.device && ` · ${deviceLabel(h.device)}`}
                {h.note && ` — ${h.note}`}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingId(h.id)}
                  className="font-medium text-moss-dark hover:underline"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  aria-label="Supprimer cette mesure"
                  className="text-clay hover:underline"
                >
                  Supprimer
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {items.length > visible.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs font-semibold text-moss-dark hover:underline"
        >
          Voir les {items.length - visible.length} mesures plus anciennes
        </button>
      )}
    </div>
  );
}
