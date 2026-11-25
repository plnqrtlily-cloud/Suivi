"use client";

import { useState } from "react";
import { addAvailabilityBlockAction, coachAddAvailabilityBlockAction, updateAvailabilityBlockAction } from "@/lib/actions";
import { Button, ErrorText, Field, SelectField, TextAreaField } from "@/components/ui";
import { DaysPicker } from "@/components/days-picker";
import { AVAILABILITY_SLOT_LABELS, AVAILABILITY_SLOT_ORDER } from "@/lib/time-of-day";
import { UNAVAILABILITY_KINDS, unavailabilityKind } from "@/lib/availability-kinds";

export interface UnavailabilityExisting {
  id: string;
  date: string;
  time_of_day: string;
  reason: string | null;
  kind?: string | null;
  notes?: string | null;
}

/**
 * Indisponibilité, la même pour l'athlète et le coach : un motif (stage,
 * entraînement, blessure ou maladie, règles, autre), une précision
 * facultative, un ou plusieurs jours à n'importe quelle date, et une note
 * juste sous les jours. Un enregistrement par jour, modifiable seul ensuite.
 */
export function UnavailabilityForm({
  athleteId,
  isFemale = false,
  defaultDate,
  existing,
  onDone,
  onCancel,
}: {
  /** Côté coach : l'athlète concerné. */
  athleteId?: string;
  isFemale?: boolean;
  defaultDate?: string;
  existing?: UnavailabilityExisting;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<string | null>(existing?.kind ?? null);
  const [dates, setDates] = useState<string[]>(existing ? [existing.date] : defaultDate ? [defaultDate] : []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const kinds = UNAVAILABILITY_KINDS.filter((k) => !k.femaleOnly || isFemale || existing?.kind === k.value);
  const current = unavailabilityKind(kind);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dates.length) return setError("Choisissez au moins un jour.");
    const fd = new FormData(e.currentTarget);
    const timeOfDay = String(fd.get("timeOfDay") || "full_day");
    const reason = String(fd.get("reason") || "");
    const notes = String(fd.get("notes") || "");
    const sorted = [...dates].sort();
    setPending(true);
    setError(undefined);
    try {
      let toAdd = sorted;
      if (existing) {
        // Le premier jour garde cette indisponibilité ; les autres en
        // deviennent des copies.
        const upd = new FormData();
        upd.set("date", sorted[0]);
        upd.set("timeOfDay", timeOfDay);
        upd.set("reason", reason);
        upd.set("kind", kind ?? "");
        upd.set("notes", notes);
        await updateAvailabilityBlockAction(existing.id, upd);
        toAdd = sorted.slice(1);
      }
      if (toAdd.length) {
        const input = { dates: toAdd, timeOfDay, reason, kind, notes };
        if (athleteId) await coachAddAvailabilityBlockAction({ athleteId, ...input });
        else await addAvailabilityBlockAction(input);
      }
      setPending(false);
      onDone();
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Motif</span>
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => {
            const on = kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(on ? null : k.value)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-moss"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
                {k.label}
              </button>
            );
          })}
        </div>
      </div>
      {kind !== "regles" && (
        <Field
          key={kind ?? "none"}
          label="Précision (facultatif)"
          name="reason"
          maxLength={120}
          defaultValue={existing?.reason ?? ""}
          placeholder={current?.placeholder || "Travail, déplacement, rendez-vous…"}
        />
      )}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
        <DaysPicker value={dates} onChange={setDates} />
      </div>
      <TextAreaField label="Note (facultatif)" name="notes" rows={2} defaultValue={existing?.notes ?? ""} placeholder="Ce qu'il faut savoir pour ces jours-là…" />
      <SelectField label="Moment" name="timeOfDay" defaultValue={existing?.time_of_day ?? "full_day"}>
        {AVAILABILITY_SLOT_ORDER.map((t) => (
          <option key={t} value={t}>
            {AVAILABILITY_SLOT_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {existing ? "Enregistrer" : dates.length > 1 ? `Enregistrer (${dates.length} jours)` : "Enregistrer"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
