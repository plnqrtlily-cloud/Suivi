"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCycleSharingAction, addCycleEntryAction } from "@/lib/actions";
import { Button, Field, SelectField } from "@/components/ui";
import { CycleEstimate, CycleSettings } from "@/lib/cycle-types";
import { CycleWheel } from "./cycle-wheel";
import { todayISO } from "@/lib/dates";

function predictNextPeriod(estimate: CycleEstimate, cycleLength: number): string | null {
  if (!estimate.lastPeriodStart) return null;
  const next = new Date(estimate.lastPeriodStart);
  next.setDate(next.getDate() + cycleLength);
  // Si la date prévue est déjà passée (cycle plus long que la moyenne), on avance d'un cycle de plus.
  while (next.getTime() < Date.now()) next.setDate(next.getDate() + cycleLength);
  return next.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export function CyclePanel({
  settings,
  estimate,
  entries,
}: {
  settings: CycleSettings;
  estimate: CycleEstimate;
  entries: any[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const nextPeriod = predictNextPeriod(estimate, settings.average_cycle_length_days);

  async function handleSharingSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await updateCycleSharingAction(new FormData(e.currentTarget));
    setPending(false);
    router.refresh();
  }

  async function handleEntrySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    await addCycleEntryAction(new FormData(form));
    setPending(false);
    form.reset();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-paper-dim p-4">
        <CycleWheel
          estimate={estimate}
          cycleLength={settings.average_cycle_length_days}
          periodLength={settings.average_period_length_days}
        />
        {nextPeriod && <p className="mt-3 text-center text-sm text-slate">Prochaines règles estimées autour du {nextPeriod}</p>}
      </div>

      <form onSubmit={handleEntrySubmit} className="grid grid-cols-2 gap-3">
        <SelectField label="Type d'entrée" name="entryType" defaultValue="period_start">
          <option value="period_start">Début des règles</option>
          <option value="period_end">Fin des règles</option>
          <option value="symptom_note">Symptôme / remarque</option>
        </SelectField>
        <Field label="Date" type="date" name="entryDate" required defaultValue={todayISO()} />
        <div className="col-span-2">
          <Field label="Notes (facultatif)" name="notes" placeholder="ex. fatigue marquée, douleurs légères…" />
        </div>
        <div className="col-span-2">
          <Button type="submit" disabled={pending}>
            Ajouter
          </Button>
        </div>
      </form>

      {entries.length > 0 && (
        <details className="text-sm text-slate">
          <summary className="cursor-pointer">Historique récent</summary>
          <ul className="mt-2 space-y-1">
            {entries.map((e) => (
              <li key={e.id}>
                {e.entry_date} —{" "}
                {e.entry_type === "period_start" ? "début des règles" : e.entry_type === "period_end" ? "fin des règles" : "note"}
                {e.notes ? ` : ${e.notes}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      <form onSubmit={handleSharingSubmit} className="rounded-2xl border border-line p-4">
        <p className="mb-1 text-sm font-medium text-ink-soft">Partage avec mes coachs</p>
        <p className="mb-3 text-xs text-slate">
          Consentement séparé de l&apos;inscription (donnée de santé, RGPD art. 9). Désactivé par défaut. Si activé,
          vos coachs actifs verront votre phase de cycle estimée — jamais le détail de vos entrées.
        </p>
        <label className="mb-3 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="share" defaultChecked={!!settings.share_with_coaches} />
          Partager la phase de mon cycle avec mes coachs
        </label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Field
            label="Durée moyenne du cycle (jours)"
            type="number"
            name="averageCycleLength"
            defaultValue={settings.average_cycle_length_days}
            min={15}
            max={45}
          />
          <Field
            label="Durée moyenne des règles (jours)"
            type="number"
            name="averagePeriodLength"
            defaultValue={settings.average_period_length_days}
            min={1}
            max={10}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          Enregistrer
        </Button>
      </form>
    </div>
  );
}
