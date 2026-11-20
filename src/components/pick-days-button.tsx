"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { DaysPicker } from "@/components/days-picker";

// Bouton (souvent dans un menu « ⋯ ») qui ouvre un calendrier pour choisir
// un jour (déplacer / reporter) ou plusieurs (copier), puis lance l'action.
export function PickDaysButton({
  children,
  className,
  title,
  multiple = false,
  initial,
  confirmLabel,
  onPick,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  multiple?: boolean;
  initial?: string;
  confirmLabel: string;
  onPick: (dates: string[]) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<string[]>(initial && !multiple ? [initial] : []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!dates.length) return;
    setPending(true);
    setError(null);
    try {
      await onPick(dates);
      setOpen(false);
      setDates(initial && !multiple ? [initial] : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
            <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
            <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-md sm:rounded-[26px]">
              <h2 className="mb-1 font-display text-xl font-semibold text-ink">{title}</h2>
              <p className="mb-4 text-[13px] text-slate">{multiple ? "Choisissez un ou plusieurs jours." : "Choisissez le nouveau jour."}</p>
              <DaysPicker
                value={dates}
                onChange={(d) => {
                  // Un seul jour pour déplacer : le dernier touché remplace le précédent.
                  const added = d.find((x) => !dates.includes(x));
                  setDates(multiple ? d : added ? [added] : d.slice(0, 1));
                }}
                rangeOnly={false}
              />
              {error && <p className="mt-2 text-sm text-[#a4492a]">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={pending || !dates.length} onClick={confirm} className="rounded-full bg-[#1b4b4f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {pending ? "…" : dates.length > 1 ? `${confirmLabel} (${dates.length} jours)` : confirmLabel}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm font-semibold text-slate">Annuler</button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
