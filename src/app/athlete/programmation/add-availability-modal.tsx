"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAvailabilityBlockAction } from "@/lib/actions";
import { Button, SelectField, Field, TextAreaField } from "@/components/ui";
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_ORDER } from "@/lib/time-of-day";

// Bouton "+" qui ouvre une fenêtre pour poser une indisponibilité personnelle
// sur un créneau (matin/midi/aprem/soir) d'un jour donné — ces blocs
// s'affichent ensuite comme des briques sur le planning, pour que le coach
// programme les séances autour plutôt qu'en plein dessus.
export function AddAvailabilityModal({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    await addAvailabilityBlockAction(new FormData(form));
    setPending(false);
    form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white hover:bg-ink/85"
        aria-label="Ajouter une indisponibilité"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 4v12M4 10h12" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-sm sm:rounded-[26px]">
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
            <h2 className="mb-1 font-display text-xl font-semibold text-ink">Indisponibilité</h2>
            <p className="mb-4 text-[13px] text-slate">
              Un rendez-vous, une obligation personnelle… votre coach le verra pour planifier autour.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="Date" type="date" name="date" required defaultValue={defaultDate} />
              <SelectField label="Créneau" name="timeOfDay" defaultValue="morning">
                {TIME_OF_DAY_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TIME_OF_DAY_LABELS[t]}
                  </option>
                ))}
              </SelectField>
              <TextAreaField label="Motif (facultatif)" name="reason" rows={2} placeholder="ex. Rendez-vous médical" />
              <Button type="submit" disabled={pending} className="mt-1">
                {pending ? "Ajout…" : "Ajouter"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
