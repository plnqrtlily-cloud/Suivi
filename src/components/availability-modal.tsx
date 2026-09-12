"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAvailabilityBlockAction, updateAvailabilityBlockAction } from "@/lib/actions";
import { Button, SelectField, Field, TextAreaField, ErrorText } from "@/components/ui";
import { AVAILABILITY_SLOT_LABELS, AVAILABILITY_SLOT_ORDER, type AvailabilitySlot } from "@/lib/time-of-day";
import { DateRangePicker, dateRangeToList } from "@/components/date-range-picker";

interface ExistingBlock {
  id: string;
  date: string;
  time_of_day: AvailabilitySlot;
  reason: string | null;
}

// Ajout : plage de dates façon Booking (une indisponibilité peut couvrir
// plusieurs jours d'affilée, ex. des vacances) — un enregistrement par jour
// créé côté serveur, cf. addAvailabilityBlockAction.
function AddAvailabilityForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const router = useRouter();
  const [rangeStart, setRangeStart] = useState<string | null>(defaultDate);
  const [rangeEnd, setRangeEnd] = useState<string | null>(defaultDate);
  const [timeOfDay, setTimeOfDay] = useState<AvailabilitySlot>("morning");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rangeStart || !rangeEnd) {
      setError("Choisissez au moins un jour.");
      return;
    }
    setPending(true);
    setError(undefined);
    const formData = new FormData(e.currentTarget);
    await addAvailabilityBlockAction({
      dates: dateRangeToList(rangeStart, rangeEnd),
      timeOfDay,
      reason: String(formData.get("reason") || ""),
    });
    setPending(false);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
        <DateRangePicker
          start={rangeStart}
          end={rangeEnd}
          onChange={({ start, end }) => {
            setRangeStart(start);
            setRangeEnd(end);
          }}
        />
      </div>
      <SelectField label="Créneau" name="timeOfDay" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value as AvailabilitySlot)}>
        {AVAILABILITY_SLOT_ORDER.map((t) => (
          <option key={t} value={t}>
            {AVAILABILITY_SLOT_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <TextAreaField label="Motif (facultatif)" name="reason" rows={2} placeholder="ex. Rendez-vous médical" />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Enregistrement…" : "Ajouter"}
      </Button>
    </form>
  );
}

// Édition : une brique existante reste un jour unique — déplacer une
// indisponibilité déjà posée vers une plage n'aurait pas de sens (elle
// deviendrait plusieurs briques distinctes, pas la même modifiée).
function EditAvailabilityForm({ existing, onDone }: { existing: ExistingBlock; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    await updateAvailabilityBlockAction(existing.id, new FormData(form));
    setPending(false);
    form.reset();
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label="Date" type="date" name="date" required defaultValue={existing.date} />
      <SelectField label="Créneau" name="timeOfDay" defaultValue={existing.time_of_day}>
        {AVAILABILITY_SLOT_ORDER.map((t) => (
          <option key={t} value={t}>
            {AVAILABILITY_SLOT_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <TextAreaField label="Motif (facultatif)" name="reason" rows={2} placeholder="ex. Rendez-vous médical" defaultValue={existing.reason || ""} />
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Enregistrement…" : "Enregistrer"}
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
// sur un créneau (matin/midi/aprem/soir/journée) d'un ou plusieurs jours — ces
// blocs s'affichent ensuite comme des briques sur le planning, pour que le
// coach programme les séances autour plutôt qu'en plein dessus.
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
          subtitle="Un rendez-vous, des vacances… votre coach le verra pour planifier autour. Cliquez un second jour pour couvrir toute une période."
          onClose={() => setOpen(false)}
        >
          <AddAvailabilityForm defaultDate={defaultDate} onDone={() => setOpen(false)} />
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
          <EditAvailabilityForm existing={block} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
