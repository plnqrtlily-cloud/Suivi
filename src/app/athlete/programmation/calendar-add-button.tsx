"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { DoneActivityForm, UnavailabilityForm, Segmented } from "@/components/add-forms";
import { CalendarEventForm } from "@/components/calendar-events";

// Point d'entrée depuis le calendrier : un événement (compétition, stage,
// rendez-vous… partagé avec le coach), une séance faite de son côté (hors
// programmation du coach) ou une indisponibilité. Mêmes formulaires que
// l'onglet + de la barre du bas.
export function CalendarAddButton({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"event" | "activity" | "unavailable">("event");
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
                    { value: "event", label: "Événement" },
                    { value: "activity", label: "Séance faite" },
                    { value: "unavailable", label: "Indisponibilité" },
                  ]}
                />
              </div>
              {mode === "event" ? (
                <CalendarEventForm defaultDate={defaultDate} onDone={close} onCancel={close} />
              ) : mode === "activity" ? (
                <DoneActivityForm defaultDate={defaultDate} onDone={close} onCancel={close} />
              ) : (
                <UnavailabilityForm defaultDate={defaultDate} onDone={close} onCancel={close} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
