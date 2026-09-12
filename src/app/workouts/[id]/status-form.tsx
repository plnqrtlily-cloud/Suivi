"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWorkoutStatusAction } from "@/lib/actions";
import { Button, Field, TextAreaField } from "@/components/ui";

const STATUSES: { value: "done" | "not_done" | "partial" | "postponed"; label: string }[] = [
  { value: "done", label: "Faite" },
  { value: "partial", label: "Partielle" },
  { value: "not_done", label: "Non réalisée" },
  { value: "postponed", label: "Reportée" },
];

// Les mêmes champs que l'import manuel d'activité, affichés selon le sport de
// la séance — inutile de demander une distance pour une séance de musculation,
// ou une puissance moyenne hors vélo.
export function StatusForm({ workoutId, currentStatus, sport }: { workoutId: string; currentStatus: string; sport: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus === "planned" ? "done" : currentStatus);
  const [rpe, setRpe] = useState(5);
  const [pending, setPending] = useState(false);
  const showDone = status === "done" || status === "partial";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    await updateWorkoutStatusAction({
      workoutId,
      status: status as any,
      rpe,
      athleteFeedback: String(formData.get("feedback") || ""),
      actualDurationMinutes: formData.get("actualDuration") ? Number(formData.get("actualDuration")) : undefined,
      distanceKm: formData.get("distanceKm") ? Number(formData.get("distanceKm")) : undefined,
      avgHr: formData.get("avgHr") ? Number(formData.get("avgHr")) : undefined,
      elevationGainM: formData.get("elevationGainM") ? Number(formData.get("elevationGainM")) : undefined,
      avgPowerW: formData.get("avgPowerW") ? Number(formData.get("avgPowerW")) : undefined,
    });
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              status === s.value ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-ink-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-soft">Ressenti (RPE) — {rpe}/10</span>
        <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} />
      </label>

      <input
        type="number"
        name="actualDuration"
        placeholder="Durée réelle (minutes, facultatif)"
        className="rounded-md border border-line bg-white px-3 py-2 text-sm"
      />

      {showDone && (
        <div className="grid grid-cols-2 gap-3">
          {sport !== "strength" && <Field label="Distance (km)" type="number" step="0.1" name="distanceKm" min={0} />}
          <Field label="FC moyenne (bpm)" type="number" name="avgHr" min={0} />
          {(sport === "hiking" || sport === "cycling" || sport === "running") && (
            <Field label="Dénivelé positif (m)" type="number" name="elevationGainM" min={0} />
          )}
          {sport === "cycling" && <Field label="Puissance moyenne (W)" type="number" name="avgPowerW" min={0} />}
        </div>
      )}

      <TextAreaField label="Sensations, remarques" name="feedback" rows={3} placeholder="Comment s'est passée la séance ?" />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
