"use client";

import { useEffect, useState } from "react";
import { DailyCheckin } from "./daily-checkin";
import { Checkin } from "@/lib/checkin-types";

// Fenêtre qui s'affiche automatiquement au premier chargement de la page si
// l'athlète n'a pas encore renseigné sa forme du jour — une seule fois par jour
// (le choix "Plus tard" ou l'enregistrement la ferment jusqu'au lendemain, via
// une marque en localStorage propre à cette date).
export function CheckinModal({ date, existing, firstName }: { date: string; existing?: Checkin; firstName: string }) {
  const [open, setOpen] = useState(false);
  const dismissKey = `checkin-dismissed-${date}`;

  useEffect(() => {
    if (existing) return;
    try {
      if (localStorage.getItem(dismissKey)) return;
    } catch {
      // localStorage indisponible (navigation privée stricte) : on affiche quand même.
    }
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // silencieux
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={dismiss} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-md sm:rounded-[26px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-semibold text-ink">Bonjour, {firstName}</h2>
          <p className="mt-1 text-[13px] text-slate">
            Avant de commencer ta journée,
            <br />
            comment te sens-tu&nbsp;?
          </p>
        </div>

        <DailyCheckin date={date} existing={existing} onSaved={dismiss} compact />

        <button type="button" onClick={dismiss} className="mt-3 w-full text-center text-xs text-slate underline underline-offset-2">
          Plus tard
        </button>
      </div>
    </div>
  );
}
