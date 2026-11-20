"use client";

import { createPortal } from "react-dom";

import { ElapsedTimeField, RouteUrlField } from "@/components/activity-extra-fields";
import { OUTDOOR_SPORTS } from "@/lib/route-url";
import { SessionDurationInput } from "@/components/session-duration-input";
import { useState } from "react";
import { updateImportedActivityAction, deleteImportedActivityAction } from "@/lib/actions";
import { Button, Field, SelectField, ErrorText } from "@/components/ui";
import { MtbPicker } from "@/components/mtb-picker";

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
  route_points?: string | null;
  discipline?: string | null;
  elapsed_minutes?: number | null;
  route_url?: string | null;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  // Rendue dans <body> : ouverte depuis un panneau ou une carte, elle ne
  // doit pas être rognée ni passer sous la barre de navigation.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-md sm:rounded-[26px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
        <h2 className="mb-1 font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mb-4 text-[13px] text-slate">{subtitle}</p>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Reprend exactement les champs/logique conditionnelle du formulaire d'import
// manuel (sync-panel.tsx) — même sports, mêmes champs affichés selon le
// sport — pour que la modification ne surprenne pas après l'ajout.
export function EditImportedActivityModal({ activity, className, children }: { activity: EditableActivity; className?: string; /** Contenu du bouton (sinon : crayon). */ children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // Un VTT s'édite comme « VTT » + son type (enregistré en vélo, cf. mtb.ts).
  const [sport, setSport] = useState(activity.discipline || activity.sport === "cycling" ? "mtb" : activity.sport);
  const [discipline, setDiscipline] = useState<string | null>(activity.discipline && activity.discipline !== "mtb" ? activity.discipline : null);
  const bike = sport === "cycling" || sport === "mtb";
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError(undefined);
    try {
      await updateImportedActivityAction(activity.id, new FormData(form));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={children ? undefined : "Modifier la séance"}
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
        <Modal title="Modifier la séance" subtitle="Corrigez les données de cette séance faite." onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date" type="date" name="activityDate" required defaultValue={activity.activity_date} />
            <Field label="Heure (facultatif)" type="time" name="activityTime" defaultValue={activity.activity_time || ""} />
            <SelectField label="Sport" name="sport" value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="running">Course à pied</option>
              <option value="mtb">Cyclisme</option>
              <option value="hiking">Randonnée</option>
              <option value="swimming">Natation</option>
              <option value="climbing">Escalade</option>
              <option value="strength">Musculation</option>
              <option value="other">Autre</option>
            </SelectField>
            {sport === "mtb" && (
              <div className="sm:col-span-2">
                <MtbPicker value={discipline} onChange={setDiscipline} name="discipline" />
              </div>
            )}
            <SessionDurationInput label={OUTDOOR_SPORTS.includes(sport) ? "Temps effectif" : "Durée"} name="durationMinutes" defaultMinutes={activity.duration_minutes ?? null} />
            {OUTDOOR_SPORTS.includes(sport) && <ElapsedTimeField defaultMinutes={activity.elapsed_minutes} />}
            {sport !== "strength" && (
              <Field label="Distance (km)" type="number" step="0.1" name="distanceKm" min={0} defaultValue={activity.distance_km ?? ""} />
            )}
            <Field label="FC moyenne (bpm)" type="number" name="avgHr" min={0} defaultValue={activity.avg_hr ?? ""} />
            {(sport === "hiking" || bike || sport === "running") && (
              <Field label="Dénivelé positif (m)" type="number" name="elevationGainM" min={0} defaultValue={activity.elevation_gain_m ?? ""} />
            )}
            {bike && (
              <Field label="Puissance moyenne (W)" type="number" name="avgPowerW" min={0} defaultValue={activity.avg_power_w ?? ""} />
            )}
            <Field label="RPE ressenti (facultatif)" type="number" name="rpe" min={1} max={10} placeholder="1 à 10" defaultValue={activity.rpe ?? ""} />
            <Field label="Notes" name="notes" defaultValue={activity.notes || ""} />
            {OUTDOOR_SPORTS.includes(sport) && (
              <div className="sm:col-span-2">
                <RouteUrlField defaultValue={activity.route_url} />
              </div>
            )}
            <div className="sm:col-span-2">
              <Field
                label={activity.route_points ? "Remplacer la trace GPS (.gpx)" : "Trace GPS (fichier .gpx, facultatif)"}
                type="file"
                name="gpxFile"
                accept=".gpx"
              />
            </div>
            {error && (
              <div className="sm:col-span-2">
                <ErrorText>{error}</ErrorText>
              </div>
            )}
            <div className="sm:col-span-2">
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
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Supprimer cette séance de votre calendrier ?")) return;
        setPending(true);
        try {
          await deleteImportedActivityAction(id);
        } finally {
          setPending(false);
        }
      }}
      aria-label="Supprimer la séance"
      title="Supprimer"
      className={`-m-1.5 p-1.5 disabled:opacity-40 ${className || ""}`}
    >
      {pending ? "…" : "✕"}
    </button>
  );
}
