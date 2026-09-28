"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { coachAddActivityAction, coachAddAvailabilityBlockAction, coachDeleteEntryAction } from "@/lib/actions";
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

type Mode = "done" | "todo" | "unavailable";

const MODES: { value: Mode; label: string }[] = [
  { value: "done", label: "Séance faite" },
  { value: "todo", label: "Séance à faire" },
  { value: "unavailable", label: "Indisponibilité" },
];

// Pendant côté coach du bouton « Ajouter » du calendrier athlète : le coach
// renseigne pour le compte de l'athlète ce qu'il a appris hors application —
// une séance déjà faite, une séance à programmer, ou une indisponibilité.
export function CoachAddEntryButton({
  athleteId,
  athleteFirstName,
  defaultDate,
  today,
  initialMode,
}: {
  athleteId: string;
  athleteFirstName: string;
  defaultDate: string;
  today: string;
  initialMode?: Mode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Par défaut : un jour passé appelle plutôt une séance faite, un jour à venir
  // une séance à programmer.
  const [mode, setMode] = useState<Mode>(initialMode ?? (defaultDate <= today ? "done" : "todo"));
  const [sport, setSport] = useState("running");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [rangeStart, setRangeStart] = useState<string | null>(defaultDate);
  const [rangeEnd, setRangeEnd] = useState<string | null>(defaultDate);

  function close() {
    setOpen(false);
    setError(undefined);
    setRangeStart(defaultDate);
    setRangeEnd(defaultDate);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (!rangeStart || !rangeEnd) {
      setError("Choisissez au moins un jour.");
      return;
    }
    const dates = dateRangeToList(rangeStart, rangeEnd);
    if (mode === "done" && dates.some((d) => d > today)) {
      setError("Une séance déjà faite ne peut pas être datée dans le futur — choisissez « Séance à faire ».");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      if (mode === "done") {
        formData.set("sport", sport);
        await Promise.all(
          dates.map((date) => {
            const perDay = new FormData();
            formData.forEach((value, key) => perDay.set(key, value));
            perDay.set("activityDate", date);
            return coachAddActivityAction(athleteId, perDay);
          })
        );
      } else if (mode === "unavailable") {
        await coachAddAvailabilityBlockAction({
          athleteId,
          dates,
          timeOfDay: String(formData.get("timeOfDay") || "full_day"),
          reason: String(formData.get("reason") || ""),
        });
      }
      form.reset();
      close();
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

  const datePicker = (hint: string) => (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
      <p className="mb-2 text-xs text-slate">{hint}</p>
      <DateRangePicker
        start={rangeStart}
        end={rangeEnd}
        onChange={({ start, end }) => {
          setRangeStart(start);
          setRangeEnd(end);
        }}
      />
    </div>
  );

  return (
    <div className="animate-expand-in w-full rounded-3xl border border-line bg-white p-4">
      <div className="mb-4 flex rounded-2xl bg-paper-dim p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              setMode(m.value);
              setError(undefined);
            }}
            className={`flex-1 rounded-xl px-2 py-1.5 text-sm font-semibold transition-colors ${
              mode === m.value ? "bg-white text-ink shadow-sm" : "text-slate"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "todo" ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate">
            La séance à faire se construit dans l&apos;éditeur habituel (intervalles, musculation, modèles…), avec la
            date déjà sélectionnée.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/coach/athletes/${athleteId}/new-workout?date=${defaultDate}`}
              className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/85"
            >
              Programmer la séance
            </Link>
            <Button type="button" variant="ghost" onClick={close}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "done" ? (
            <>
              <p className="text-xs text-slate">
                Une séance que {athleteFirstName} a faite sans la saisir (racontée à l&apos;oral, par message…). Elle
                apparaîtra dans son calendrier comme renseignée par vous et comptera dans sa charge.
              </p>
              {datePicker("Cliquez un jour, ou un second pour couvrir une période (stage, trek…).")}
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
                <Field label="RPE (1-10)" type="number" name="rpe" min={1} max={10} />
              </div>
              <TextAreaField label="Notes (facultatif)" name="notes" rows={2} placeholder="Contenu, sensations rapportées…" />
            </>
          ) : (
            <>
              <p className="text-xs text-slate">
                {athleteFirstName} n&apos;est pas disponible — l&apos;indisponibilité s&apos;affichera sur son planning
                comme sur le vôtre.
              </p>
              {datePicker("Cliquez un jour, ou un second pour couvrir une période (déplacement, vacances…).")}
              <SelectField label="Moment" name="timeOfDay" defaultValue="full_day">
                {Object.entries(AVAILABILITY_SLOT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <Field label="Motif (facultatif)" name="reason" placeholder="Déplacement, blessure, examens…" />
            </>
          )}

          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Petite croix sur une entrée saisie par le coach, pour corriger une erreur de
// saisie — n'apparaît jamais sur ce que l'athlète a renseigné lui-même.
export function CoachDeleteEntryButton({ kind, id, dark }: { kind: "activity" | "availability"; id: string; dark?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      await coachDeleteEntryAction(kind, id);
      router.refresh();
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  const tone = dark ? "text-white/70 hover:text-white" : "text-slate hover:text-ink";
  if (confirming) {
    return (
      <span className="flex flex-shrink-0 items-center gap-2 text-xs">
        <button type="button" onClick={handleDelete} disabled={pending} className={`font-semibold ${dark ? "text-white" : "text-red-700"}`}>
          {pending ? "…" : "Supprimer"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={tone}>
          Annuler
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)} aria-label="Supprimer" className={`flex-shrink-0 ${tone}`}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  );
}
