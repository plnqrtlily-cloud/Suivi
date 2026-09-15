"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addExerciseMaxAction, deleteExerciseMaxAction } from "@/lib/actions";
import { Field, Button, SelectField } from "@/components/ui";
import { DurationInput, formatDuration } from "@/components/duration-input";
import { TrendChart } from "@/components/trend-chart";
import type { ExerciseMax } from "@/lib/queries";
import { todayISO } from "@/lib/dates";

const VALUE_TYPES: { value: "charge" | "temps" | "repetitions"; label: string; unit: string }[] = [
  { value: "charge", label: "Charge", unit: "kg" },
  { value: "temps", label: "Durée", unit: "" },
  { value: "repetitions", label: "Répétitions", unit: "reps" },
];

function displayValue(m: ExerciseMax): string {
  if (m.value_type === "temps") return formatDuration(m.value_kg);
  if (m.value_type === "repetitions") return `${m.value_kg} reps`;
  return `${m.value_kg} kg`;
}

// Charges testées par exercice — sert de repère pour prescrire une charge en
// pourcentage (StrengthBuilder convertit automatiquement en kg à partir du
// dernier max connu par exercice, pour le type "charge" uniquement) plutôt
// qu'en valeur absolue devinée. Renseignable par l'athlète ou son coach.
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
  const [valueType, setValueType] = useState<"charge" | "temps" | "repetitions">("charge");
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    await addExerciseMaxAction(athleteId, new FormData(form));
    setPending(false);
    form.reset();
    setValueType("charge");
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteExerciseMaxAction(id, athleteId);
    router.refresh();
  }

  // Regroupe par exercice pour proposer une tendance là où plusieurs mesures
  // existent à des dates différentes — inutile d'afficher un graphique pour un
  // exercice mesuré une seule fois.
  const byExercise = new Map<string, ExerciseMax[]>();
  for (const m of maxes) {
    if (!byExercise.has(m.exercise_name)) byExercise.set(m.exercise_name, []);
    byExercise.get(m.exercise_name)!.push(m);
  }

  return (
    <div>
      <datalist id="max-exercise-suggestions">
        {exerciseSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <ul className="mb-4 space-y-1.5 text-sm">
        {[...byExercise.entries()].map(([exerciseName, entries]) => {
          // Le plus récent d'abord (tested_at DESC déjà côté requête).
          const hasTrend = entries.length >= 2 && entries.every((e) => e.value_type === entries[0].value_type);
          const isExpanded = expandedExercise === exerciseName;
          return (
            <li key={exerciseName} className="rounded-xl bg-paper-dim p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink">
                  <b className="font-semibold">{exerciseName}</b> — {displayValue(entries[0])}
                </span>
                <span className="flex flex-shrink-0 items-center gap-2 text-slate">
                  <span className="text-xs">{entries[0].tested_at}</span>
                  {hasTrend && (
                    <button
                      type="button"
                      onClick={() => setExpandedExercise(isExpanded ? null : exerciseName)}
                      className="text-xs font-medium text-moss-dark hover:underline"
                    >
                      {isExpanded ? "Masquer" : "Évolution"}
                    </button>
                  )}
                  <button type="button" onClick={() => handleDelete(entries[0].id)} aria-label="Supprimer ce max" className="hover:text-clay">
                    ✕
                  </button>
                </span>
              </div>
              {entries[0].note && <p className="mt-1 text-xs text-ink-soft">{entries[0].note}</p>}

              {isExpanded && (
                <div className="mt-3 rounded-xl border border-line bg-white p-3">
                  <TrendChart
                    series={[...entries].reverse().map((e) => ({ value: e.value_kg, recorded_at: e.tested_at }))}
                    unit={VALUE_TYPES.find((t) => t.value === entries[0].value_type)?.unit}
                  />
                </div>
              )}

              {/* Historique complet si plus d'une mesure, pour voir le détail sans
                  attendre le graphique. */}
              {entries.length > 1 && (
                <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-slate">
                  {entries.slice(1).map((e) => (
                    <li key={e.id} className="flex items-center justify-between">
                      <span>
                        {displayValue(e)} {e.note && `— ${e.note}`}
                      </span>
                      <span className="flex items-center gap-2">
                        {e.tested_at}
                        <button type="button" onClick={() => handleDelete(e.id)} aria-label="Supprimer" className="hover:text-clay">
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {maxes.length === 0 && <p className="text-slate">Aucun max testé pour l&apos;instant.</p>}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-soft">Exercice</span>
            <input
              list="max-exercise-suggestions"
              name="exerciseName"
              placeholder="ex. Squat"
              required
              className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
            />
          </label>
          <SelectField label="Type de mesure" value={valueType} onChange={(e) => setValueType(e.target.value as typeof valueType)}>
            {VALUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <Field label="Date du test" type="date" name="testedAt" required defaultValue={todayISO()} />
        </div>

        {valueType === "temps" ? (
          <DurationInput name="value" required />
        ) : (
          <Field
            label={valueType === "charge" ? "Charge (kg)" : "Nombre de répétitions"}
            type="number"
            step={valueType === "charge" ? "0.5" : "1"}
            name="value"
            required
            min={0}
          />
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">Note (facultatif)</span>
          <input
            name="note"
            placeholder="Contexte, sensations, technique…"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
          />
        </label>

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Ajout…" : "Ajouter"}
          </Button>
        </div>
      </form>
    </div>
  );
}
