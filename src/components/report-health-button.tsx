"use client";

import { useState } from "react";
import { HealthReportForm } from "./add-forms";

// « Signaler » depuis Moi › Santé : la même feuille que l'onglet +.
export function ReportHealthButton({ today, coachName }: { today: string; coachName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-moss-dark px-4 py-2.5 text-sm font-bold text-white">
        Signaler une blessure, une maladie ou un état
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-label="Comment tu vas ?"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white px-5 pb-7 pt-4 shadow-2xl sm:max-w-md sm:rounded-[26px]"
          >
            <div className="mb-4 flex items-center">
              <h2 className="text-xl font-bold text-ink">Comment tu vas ?</h2>
              <span className="flex-1" />
              <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="-m-2 p-2 text-slate">
                ✕
              </button>
            </div>
            <HealthReportForm defaultDate={today} coachName={coachName} onDone={() => setOpen(false)} />
          </section>
        </div>
      )}
    </>
  );
}
