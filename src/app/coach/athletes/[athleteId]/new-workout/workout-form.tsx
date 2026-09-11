"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkoutAction } from "@/lib/actions";
import { Field, SelectField, TextAreaField, Button, ErrorText } from "@/components/ui";
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

const COLORS = ["#2F6F5E", "#7C5C46", "#5B6660", "#B08A3E", "#6B7A8A"];

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
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await createWorkoutAction({
        athleteId,
        sport,
        category,
        priority: String(formData.get("priority") || ""),
        title: String(formData.get("title")),
        date: String(formData.get("date")),
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
                sets: b.sets.filter((s) => s.reps || s.load),
              }))
            : undefined,
      });
      router.push(`/workouts/${result.workoutId}`);
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

      <div className="grid grid-cols-3 gap-4">
        <Field label="Date" type="date" name="date" required />
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
              style={{ backgroundColor: c, borderColor: color === c ? "#16231E" : "transparent" }}
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
