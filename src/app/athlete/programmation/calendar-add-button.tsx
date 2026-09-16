"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addImportedActivityAction, addAvailabilityBlockAction } from "@/lib/actions";
import { Button, Field, SelectField, TextAreaField, ErrorText } from "@/components/ui";
import { AVAILABILITY_SLOT_LABELS } from "@/lib/time-of-day";

const SPORTS = [
  { value: "running", label: "Course à pied" },
  { value: "cycling", label: "Vélo" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
  { value: "other", label: "Autre" },
];

// Point d'entrée unique depuis le calendrier : l'athlète y déclare soit une
// séance qu'il a faite de son côté (hors programmation du coach), soit une
// indisponibilité — les deux se rattachent à un jour, d'où leur place ici
// plutôt que dispersées dans le profil.
export function CalendarAddButton({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"activity" | "unavailable">("activity");
  const [sport, setSport] = useState("running");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(undefined);
    try {
      if (mode === "activity") {
        formData.set("sport", sport);
        await addImportedActivityAction(formData);
      } else {
        await addAvailabilityBlockAction({
          dates: [String(formData.get("date") || defaultDate)],
          timeOfDay: String(formData.get("timeOfDay") || "full_day"),
          reason: String(formData.get("reason") || ""),
        });
      }
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
    }
    setPending(false);
  }

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
    <div className="rounded-3xl border border-line bg-white p-4">
      <div className="mb-4 flex rounded-2xl bg-paper-dim p-1">
        <button
          type="button"
          onClick={() => setMode("activity")}
          className={`flex-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "activity" ? "bg-white text-ink shadow-sm" : "text-slate"
          }`}
        >
          Séance que j&apos;ai faite
        </button>
        <button
          type="button"
          onClick={() => setMode("unavailable")}
          className={`flex-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "unavailable" ? "bg-white text-ink shadow-sm" : "text-slate"
          }`}
        >
          Indisponibilité
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "activity" ? (
          <>
            <p className="text-xs text-slate">
              Une séance faite de votre côté, en plus de ce que votre coach a programmé — elle comptera dans votre
              charge d&apos;entraînement.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Date" type="date" name="activityDate" required defaultValue={defaultDate} />
              <Field label="Heure (facultatif)" type="time" name="activityTime" />
              <SelectField label="Sport" value={sport} onChange={(e) => setSport(e.target.value)}>
                {SPORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </SelectField>
              <Field label="Durée (min)" type="number" name="durationMinutes" min={0} />
              {sport !== "strength" && <Field label="Distance (km)" type="number" step="0.1" name="distanceKm" min={0} />}
              <Field label="FC moyenne (bpm)" type="number" name="avgHr" min={0} />
              {(sport === "running" || sport === "cycling" || sport === "hiking") && (
                <Field label="Dénivelé positif (m)" type="number" name="elevationGainM" min={0} />
              )}
              {sport === "cycling" && <Field label="Puissance moyenne (W)" type="number" name="avgPowerW" min={0} />}
              <Field label="RPE ressenti (1-10)" type="number" name="rpe" min={1} max={10} />
            </div>
            <TextAreaField label="Notes (facultatif)" name="notes" rows={2} placeholder="Sensations, contexte…" />
          </>
        ) : (
          <>
            <p className="text-xs text-slate">
              Prévenez votre coach que vous n&apos;êtes pas disponible — il le verra en programmant vos séances.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Date" type="date" name="date" required defaultValue={defaultDate} />
              <SelectField label="Moment" name="timeOfDay" defaultValue="full_day">
                {Object.entries(AVAILABILITY_SLOT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
            <Field label="Motif (facultatif)" name="reason" placeholder="Déplacement, travail, repos…" />
          </>
        )}

        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
