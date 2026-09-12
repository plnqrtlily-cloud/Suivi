"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateImportedActivityAction, deleteImportedActivityAction } from "@/lib/actions";
import { Button, Field, SelectField } from "@/components/ui";

export interface EditableActivity {
  id: string;
  activity_date: string;
  activity_time: string | null;
  sport: string;
  duration_minutes: number | null;
  distance_km: number | null;
  avg_hr: number | null;
  elevation_gain_m: number | null;
  avg_power_w: number | null;
  rpe: number | null;
  notes: string | null;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-md sm:rounded-[26px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
        <h2 className="mb-1 font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mb-4 text-[13px] text-slate">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

// Reprend exactement les champs/logique conditionnelle du formulaire d'import
// manuel (sync-panel.tsx) — même sports, mêmes champs affichés selon le
// sport — pour que la modification ne surprenne pas après l'ajout.
export function EditImportedActivityModal({ activity, className }: { activity: EditableActivity; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sport, setSport] = useState(activity.sport);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    await updateImportedActivityAction(activity.id, new FormData(form));
    setPending(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Modifier l'activité" className={className}>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 3.5l3 3L7 16l-4 1 1-4z" />
        </svg>
      </button>
      {open && (
        <Modal title="Modifier l'activité" subtitle="Ajustez les données de cette activité importée." onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
            <Field label="Date" type="date" name="activityDate" required defaultValue={activity.activity_date} />
            <Field label="Heure (facultatif)" type="time" name="activityTime" defaultValue={activity.activity_time || ""} />
            <SelectField label="Sport" name="sport" value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="running">Course à pied</option>
              <option value="cycling">Vélo</option>
              <option value="hiking">Randonnée</option>
              <option value="swimming">Natation</option>
              <option value="climbing">Escalade</option>
              <option value="strength">Musculation</option>
            </SelectField>
            <Field label="Durée (minutes)" type="number" name="durationMinutes" min={0} defaultValue={activity.duration_minutes ?? ""} />
            {sport !== "strength" && (
              <Field label="Distance (km)" type="number" step="0.1" name="distanceKm" min={0} defaultValue={activity.distance_km ?? ""} />
            )}
            <Field label="FC moyenne (bpm)" type="number" name="avgHr" min={0} defaultValue={activity.avg_hr ?? ""} />
            {(sport === "hiking" || sport === "cycling" || sport === "running") && (
              <Field label="Dénivelé positif (m)" type="number" name="elevationGainM" min={0} defaultValue={activity.elevation_gain_m ?? ""} />
            )}
            {sport === "cycling" && (
              <Field label="Puissance moyenne (W)" type="number" name="avgPowerW" min={0} defaultValue={activity.avg_power_w ?? ""} />
            )}
            <Field label="RPE ressenti (facultatif)" type="number" name="rpe" min={1} max={10} placeholder="1 à 10" defaultValue={activity.rpe ?? ""} />
            <Field label="Notes" name="notes" defaultValue={activity.notes || ""} />
            <div className="col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeleteImportedActivityButton({ id, className }: { id: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteImportedActivityAction(id);
        router.refresh();
      }}
      aria-label="Supprimer l'activité"
      className={className}
    >
      ✕
    </button>
  );
}
