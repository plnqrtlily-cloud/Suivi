"use client";

import { createPortal } from "react-dom";

import { useState } from "react";
import type { AvailabilitySlot } from "@/lib/time-of-day";
import { UnavailabilityForm } from "@/components/unavailability-form";

export interface ExistingBlock {
  id: string;
  date: string;
  time_of_day: AvailabilitySlot;
  reason: string | null;
  kind?: string | null;
  notes?: string | null;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  // Rendue dans <body> : ouverte depuis un panneau ou une carte, elle ne
  // doit pas être rognée ni passer sous la barre de navigation.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-sm sm:rounded-[26px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
        <h2 className="mb-1 font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mb-4 text-[13px] text-slate">{subtitle}</p>
        {children}
      </div>
    </div>,
    document.body,
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
          subtitle="Stage, entraînement, blessure, déplacement… ton coach le verra pour planifier autour."
          onClose={() => setOpen(false)}
        >
          <UnavailabilityForm defaultDate={defaultDate} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

// Icône crayon posée sur une brique existante pour la modifier (date, créneau,
// motif) sans avoir à la supprimer puis en recréer une.
export function EditAvailabilityModal({
  block,
  athleteId,
  isFemale,
  className,
  children,
}: {
  block: ExistingBlock;
  /** Côté coach : jours ajoutés en plus créés pour cet athlète. */
  athleteId?: string;
  isFemale?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={children ? undefined : "Modifier l'indisponibilité"}
        title="Modifier"
        className={children ? className : `-m-1.5 p-1.5 ${className || ""}`}
      >
        {children ?? (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 3.5l3 3L7 16l-4 1 1-4z" />
          </svg>
        )}
      </button>

      {open && (
        <Modal title="Modifier l'indisponibilité" subtitle="Motif, jour(s), note ou moment : tout se modifie. D'autres jours ajoutés deviennent des copies." onClose={() => setOpen(false)}>
          <UnavailabilityForm existing={block} athleteId={athleteId} isFemale={isFemale} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
