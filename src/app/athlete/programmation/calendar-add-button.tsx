"use client";

import { useState } from "react";
import { DoneActivityForm, UnavailabilityForm, Segmented } from "@/components/add-forms";

// Point d'entrée depuis le calendrier : une séance faite de son côté (hors
// programmation du coach) ou une indisponibilité. Mêmes formulaires que
// l'onglet + de la barre du bas.
export function CalendarAddButton({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"activity" | "unavailable">("activity");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-moss-dark hover:border-moss"
      >
        <span className="text-base leading-none">+</span> Ajouter
      </button>
    );
  }

  return (
    <div className="animate-expand-in w-full rounded-3xl border border-line bg-white p-4">
      <div className="mb-4">
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          options={[
            { value: "activity", label: "Séance que j'ai faite" },
            { value: "unavailable", label: "Indisponibilité" },
          ]}
        />
      </div>
      {mode === "activity" ? (
        <DoneActivityForm defaultDate={defaultDate} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      ) : (
        <UnavailabilityForm defaultDate={defaultDate} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      )}
    </div>
  );
}
