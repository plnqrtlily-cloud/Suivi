"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { duplicateWorkoutAction } from "@/lib/actions";
import { Button, Field, SelectField } from "@/components/ui";
import { todayISO } from "@/lib/dates";

interface AthleteOption {
  athlete_id: string;
  first_name: string;
  last_name: string;
}

// Recrée la séance (avec sa structure de blocs le cas échéant) à un autre
// jour et/ou pour un autre athlète du coach — s'appuie sur la même logique
// d'insertion que la création (cf. duplicateWorkoutAction).
export function DuplicateWorkoutButton({
  workoutId,
  athleteId,
  otherAthletes,
}: {
  workoutId: string;
  athleteId: string;
  otherAthletes: AthleteOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const targetDate = String(formData.get("targetDate") || "");
    const targetAthleteId = String(formData.get("targetAthleteId") || athleteId);
    if (!targetDate) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await duplicateWorkoutAction({ workoutId, targetDate, targetAthleteId });
      router.push(`/workouts/${result.workoutIds[0]}`);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-moss-dark hover:underline">
        Dupliquer
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-t-[26px] bg-white p-6 shadow-2xl sm:rounded-[26px]">
            <h2 className="mb-1 font-display text-xl font-semibold text-ink">Dupliquer la séance</h2>
            <p className="mb-4 text-[13px] text-slate">Recrée cette séance (structure comprise) à un autre jour, pour le même athlète ou un autre.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="Nouveau jour" type="date" name="targetDate" required defaultValue={todayISO()} />
              {otherAthletes.length > 0 && (
                <SelectField label="Pour" name="targetAthleteId" defaultValue={athleteId}>
                  <option value={athleteId}>Le même athlète</option>
                  {otherAthletes.map((a) => (
                    <option key={a.athlete_id} value={a.athlete_id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </SelectField>
              )}
              {error && <p className="text-sm text-clay">{error}</p>}
              <Button type="submit" disabled={pending}>
                {pending ? "Duplication…" : "Dupliquer"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
