"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addImportedActivityAction, addAvailabilityBlockAction } from "@/lib/actions";
import { Button, Field, SelectField, TextAreaField, ErrorText } from "@/components/ui";
import { AVAILABILITY_SLOT_LABELS } from "@/lib/time-of-day";
import { DateRangePicker, dateRangeToList } from "@/components/date-range-picker";

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
  // Plage de dates commune aux deux onglets : une activité peut s'étaler sur
  // plusieurs jours (trek, stage), et une indisponibilité aussi (déplacement,
  // vacances). Un seul jour reste possible : on clique deux fois le même.
  const [rangeStart, setRangeStart] = useState<string | null>(defaultDate);
  const [rangeEnd, setRangeEnd] = useState<string | null>(defaultDate);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(undefined);
    try {
      if (!rangeStart || !rangeEnd) {
        setError("Choisissez au moins un jour.");
        setPending(false);
        return;
      }
      const dates = dateRangeToList(rangeStart, rangeEnd);

      if (mode === "activity") {
        formData.set("sport", sport);
        // Une activité par jour de la plage : chacune reste modifiable
        // indépendamment (une étape de trek n'a pas la même durée qu'une autre).
        // Envoyées en parallèle plutôt qu'une par une : ce sont des insertions
        // indépendantes, attendre chaque aller-retour serveur avant le suivant
        // multipliait inutilement la latence sur une plage de plusieurs jours.
        await Promise.all(
          dates.map((date) => {
            const perDay = new FormData();
            formData.forEach((value, key) => perDay.set(key, value));
            perDay.set("activityDate", date);
            return addImportedActivityAction(perDay);
          })
        );
      } else {
        await addAvailabilityBlockAction({
          dates,
          timeOfDay: String(formData.get("timeOfDay") || "full_day"),
          reason: String(formData.get("reason") || ""),
        });
      }
      form.reset();
      setRangeStart(defaultDate);
      setRangeEnd(defaultDate);
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
    <div className="animate-expand-in rounded-3xl border border-line bg-white p-4">
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
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
              <p className="mb-2 text-xs text-slate">
                Cliquez un jour, ou un second pour couvrir toute la période (stage, trek…).
              </p>
              <DateRangePicker
                start={rangeStart}
                end={rangeEnd}
                onChange={({ start, end }) => {
                  setRangeStart(start);
                  setRangeEnd(end);
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
              <p className="mb-2 text-xs text-slate">
                Cliquez un jour, ou un second pour couvrir toute la période (déplacement, vacances…).
              </p>
              <DateRangePicker
                start={rangeStart}
                end={rangeEnd}
                onChange={({ start, end }) => {
                  setRangeStart(start);
                  setRangeEnd(end);
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
