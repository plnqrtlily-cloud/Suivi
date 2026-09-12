"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAvailabilityBlockAction, updateAvailabilityBlockAction } from "@/lib/actions";
import { Button, SelectField, Field, TextAreaField } from "@/components/ui";
import { AVAILABILITY_SLOT_LABELS, AVAILABILITY_SLOT_ORDER, type AvailabilitySlot } from "@/lib/time-of-day";

interface ExistingBlock {
  id: string;
  date: string;
  time_of_day: AvailabilitySlot;
  reason: string | null;
}

function AvailabilityForm({
  defaultDate,
  existing,
  onDone,
}: {
  defaultDate: string;
  existing?: ExistingBlock;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    const formData = new FormData(form);
    if (existing) await updateAvailabilityBlockAction(existing.id, formData);
    else await addAvailabilityBlockAction(formData);
    setPending(false);
    form.reset();
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label="Date" type="date" name="date" required defaultValue={existing?.date || defaultDate} />
      <SelectField label="Créneau" name="timeOfDay" defaultValue={existing?.time_of_day || "morning"}>
        {AVAILABILITY_SLOT_ORDER.map((t) => (
          <option key={t} value={t}>
            {AVAILABILITY_SLOT_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <TextAreaField label="Motif (facultatif)" name="reason" rows={2} placeholder="ex. Rendez-vous médical" defaultValue={existing?.reason || ""} />
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Enregistrement…" : existing ? "Enregistrer" : "Ajouter"}
      </Button>
    </form>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-sm sm:rounded-[26px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
        <h2 className="mb-1 font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mb-4 text-[13px] text-slate">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

// Bouton "+" qui ouvre une fenêtre pour poser une indisponibilité personnelle
// sur un créneau (matin/midi/aprem/soir/journée) d'un jour donné — ces blocs
// s'affichent ensuite comme des briques sur le planning, pour que le coach
// programme les séances autour plutôt qu'en plein dessus.
export function AddAvailabilityModal({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
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
        <Modal
          title="Indisponibilité"
          subtitle="Un rendez-vous, une obligation personnelle… votre coach le verra pour planifier autour."
          onClose={() => setOpen(false)}
        >
          <AvailabilityForm defaultDate={defaultDate} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

// Icône crayon posée sur une brique existante pour la modifier (date, créneau,
// motif) sans avoir à la supprimer puis en recréer une.
export function EditAvailabilityModal({ block, className }: { block: ExistingBlock; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Modifier l'indisponibilité" className={className}>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 3.5l3 3L7 16l-4 1 1-4z" />
        </svg>
      </button>

      {open && (
        <Modal title="Modifier l'indisponibilité" subtitle="Ajustez le jour, le créneau ou le motif." onClose={() => setOpen(false)}>
          <AvailabilityForm defaultDate={block.date} existing={block} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
