"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { UnavailabilityForm, Segmented } from "@/components/add-forms";
import { AthleteTrainingForm } from "@/components/athlete-training-form";
import { CalendarEventForm } from "@/components/calendar-events";

// Point d'entrée depuis le calendrier : un entraînement (passé ou à venir), un événement (compétition, stage,
// rendez-vous… partagé avec le coach), une note
// ou une indisponibilité. Mêmes formulaires que
// l'onglet + de la barre du bas.
export function CalendarAddButton({ defaultDate, isFemale = false }: { defaultDate: string; isFemale?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"training" | "event" | "note" | "unavailable">("training");
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-moss-dark hover:border-moss"
      >
        <span className="text-base leading-none">+</span> Ajouter
      </button>
      {/* Fenêtre rendue dans <body>, au-dessus du calendrier : faire défiler un
          long formulaire ne fait pas défiler le calendrier dessous, et elle
          passe devant la barre de navigation. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 sm:items-center sm:p-6" onClick={close}>
            <div
              role="dialog"
              aria-label="Ajouter"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] bg-white px-5 pt-4 shadow-2xl sm:max-w-md sm:rounded-[26px]"
              style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
            >
              <div className="mb-4">
                <Segmented
                  value={mode}
                  onChange={(v) => setMode(v as typeof mode)}
                  options={[
                    { value: "training", label: "Entraînement" },
                    { value: "event", label: "Événement" },
                    { value: "note", label: "Note" },
                    { value: "unavailable", label: "Indispo" },
                  ]}
                />
              </div>
              {mode === "training" ? (
                // Passé ou à venir : une vraie séance, visible par le coach, qui est prévenu.
                <AthleteTrainingForm defaultDate={defaultDate} onDone={close} onCancel={close} />
              ) : mode === "event" ? (
                <CalendarEventForm key="event" defaultDate={defaultDate} onDone={close} onCancel={close} />
              ) : mode === "note" ? (
                // Note sur un ou plusieurs jours, visible aussi par le coach.
                <CalendarEventForm key="note" initialKind="note" defaultDate={defaultDate} onDone={close} onCancel={close} />
              ) : (
                <UnavailabilityForm isFemale={isFemale} defaultDate={defaultDate} onDone={close} onCancel={close} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
