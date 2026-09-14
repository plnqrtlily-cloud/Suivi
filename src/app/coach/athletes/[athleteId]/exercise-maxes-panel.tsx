"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addExerciseMaxAction, deleteExerciseMaxAction } from "@/lib/actions";
import { Field, Button } from "@/components/ui";
import type { ExerciseMax } from "@/lib/queries";
import { todayISO } from "@/lib/dates";

// Charges testées par exercice — sert de repère pour prescrire une charge en
// pourcentage (StrengthBuilder convertit automatiquement en kg à partir du
// dernier max connu par exercice) plutôt qu'en valeur absolue devinée.
export function ExerciseMaxesPanel({
  athleteId,
  maxes,
  exerciseSuggestions,
}: {
  athleteId: string;
  maxes: ExerciseMax[];
  exerciseSuggestions: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    await addExerciseMaxAction(athleteId, new FormData(form));
    setPending(false);
    form.reset();
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteExerciseMaxAction(id, athleteId);
    router.refresh();
  }

  return (
    <div>
      <datalist id="max-exercise-suggestions">
        {exerciseSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <ul className="mb-4 space-y-1.5 text-sm">
        {maxes.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-paper-dim p-2">
            <span className="text-ink">
              <b className="font-semibold">{m.exercise_name}</b> — {m.value_kg} kg
            </span>
            <span className="flex flex-shrink-0 items-center gap-2 text-slate">
              <span className="text-xs">{m.tested_at}</span>
              <button type="button" onClick={() => handleDelete(m.id)} aria-label="Supprimer ce max" className="hover:text-clay">
                ✕
              </button>
            </span>
          </li>
        ))}
        {maxes.length === 0 && <p className="text-slate">Aucun max testé pour l&apos;instant.</p>}
      </ul>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
        <label className="col-span-full flex flex-col gap-1.5 text-sm sm:col-span-1">
          <span className="font-medium text-ink-soft">Exercice</span>
          <input
            list="max-exercise-suggestions"
            name="exerciseName"
            placeholder="ex. Squat"
            required
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
          />
        </label>
        <Field label="Charge (kg)" type="number" step="0.5" name="valueKg" required min={0} />
        <Field label="Date du test" type="date" name="testedAt" required defaultValue={todayISO()} />
        <div className="col-span-full">
          <Button type="submit" disabled={pending}>
            {pending ? "Ajout…" : "Ajouter"}
          </Button>
        </div>
      </form>
    </div>
  );
}
