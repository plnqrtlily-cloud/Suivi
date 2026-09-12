"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkoutAction } from "@/lib/actions";
import { Field, SelectField, TextAreaField, Button, ErrorText } from "@/components/ui";
import { DateRangePicker, dateRangeToList } from "@/components/date-range-picker";
import { StrengthBuilder, BlockRow, LibraryResource } from "./strength-builder";

const SPORTS = [
  { value: "running", label: "Course à pied" },
  { value: "cycling", label: "Vélo (Route/VTT/BMX)" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
];

const CATEGORIES = [
  { value: "entrainement", label: "Entraînement" },
  { value: "objectif", label: "Objectif" },
  { value: "evenement", label: "Événement / compétition" },
  { value: "divers", label: "Divers" },
];

// Repris de la palette du produit (globals.css) plutôt que de teintes ad hoc.
const COLORS = ["#1B4B4F", "#E8896A", "#7C5C46", "#5B6660", "#6B7A8A"];

export function WorkoutForm({
  athleteId,
  resources,
  exerciseHistory,
}: {
  athleteId: string;
  resources: LibraryResource[];
  exerciseHistory: string[];
}) {
  const router = useRouter();
  const [sport, setSport] = useState("running");
  const [category, setCategory] = useState("entrainement");
  const [color, setColor] = useState(COLORS[0]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rangeStart || !rangeEnd) {
      setError("Choisissez au moins un jour dans le calendrier.");
      return;
    }
    setPending(true);
    setError(undefined);
    const formData = new FormData(e.currentTarget);
    const dates = dateRangeToList(rangeStart, rangeEnd);
    try {
      const result = await createWorkoutAction({
        athleteId,
        sport,
        category,
        priority: String(formData.get("priority") || ""),
        title: String(formData.get("title")),
        dates,
        time: String(formData.get("time") || ""),
        durationMinutes: formData.get("duration") ? Number(formData.get("duration")) : undefined,
        description: String(formData.get("description") || ""),
        color,
        blocks:
          sport === "strength"
            ? blocks.map((b) => ({
                block_type: b.block_type,
                exercise_name: b.exercise_name,
                notes: b.notes || undefined,
                resource_id: b.resource_id || undefined,
                training_quality: b.training_quality || undefined,
                sets: b.sets
                  .filter((s) => s.reps || s.load)
                  .map((s) => ({
                    reps: s.reps,
                    load: s.load,
                    restSeconds: s.restSeconds ? Number(s.restSeconds) : undefined,
                    rpe: s.rpe ? Number(s.rpe) : undefined,
                  })),
              }))
            : undefined,
      });
      router.push(dates.length === 1 ? `/workouts/${result.workoutIds[0]}` : `/coach/athletes/${athleteId}`);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <SelectField label="Sport" value={sport} onChange={(e) => setSport(e.target.value)}>
        {SPORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Titre de la séance" name="title" required placeholder="ex. Sortie longue endurance" />
        <SelectField label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </div>

      {(category === "objectif" || category === "evenement") && (
        <SelectField
          label="Priorité"
          name="priority"
          defaultValue=""
        >
          <option value="">Non définie</option>
          <option value="A">A — Objectif principal (l'affûtage se planifie autour de cette date)</option>
          <option value="B">B — Objectif secondaire</option>
          <option value="C">C — Sortie de calage / test</option>
        </SelectField>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
        <p className="mb-2 text-xs text-slate">
          Cliquez un jour pour une séance unique, ou un deuxième jour pour répéter la même séance sur toute la période
          (comme sur Booking pour un séjour).
        </p>
        <DateRangePicker start={rangeStart} end={rangeEnd} onChange={({ start, end }) => { setRangeStart(start); setRangeEnd(end); }} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Heure (facultatif)" type="time" name="time" />
        <Field label="Durée prévue (minutes)" type="number" name="duration" min={0} />
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-soft">Couleur</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full border-2"
              style={{ backgroundColor: c, borderColor: color === c ? "#182220" : "transparent" }}
              aria-label={`Choisir la couleur ${c}`}
            />
          ))}
        </div>
      </label>

      {sport === "strength" ? (
        <div>
          <p className="mb-3 text-sm font-medium text-ink-soft">Structure de la séance</p>
          <StrengthBuilder onChange={setBlocks} resources={resources} exerciseHistory={exerciseHistory} />
        </div>
      ) : (
        <TextAreaField
          label="Description de la séance"
          name="description"
          rows={5}
          placeholder="Détail des allures, intervalles, parcours, consignes techniques…"
        />
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer la séance"}
        </Button>
      </div>
    </form>
  );
}
