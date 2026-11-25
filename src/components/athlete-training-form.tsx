"use client";

import { useState } from "react";
import { createAthleteTrainingAction, updateAthleteTrainingAction } from "@/lib/actions";
import { Button, ErrorText, Field, SelectField, TextAreaField } from "@/components/ui";
import { DaysPicker } from "@/components/days-picker";
import { SessionDurationInput } from "@/components/session-duration-input";
import { RouteUrlField } from "@/components/activity-extra-fields";
import { MtbPicker } from "@/components/mtb-picker";
import { ELEVATION_SPORTS, TRAINING_SPORTS, guessMtbFromTitle, guessSportFromTitle } from "@/lib/calendar-event-kinds";
import { INDOOR_CYCLING } from "@/lib/mtb";
import { toISODate } from "@/lib/dates";
import { StatusForm, type StatusInitial } from "@/app/workouts/[id]/status-form";

export interface AthleteTrainingExisting {
  id: string;
  title: string;
  /** Sport en base (cycling, running…). */
  sport: string;
  discipline: string | null;
  date: string;
  time: string | null;
  durationMinutes: number | null;
  elevationGainM: number | null;
  routeUrl: string | null;
  description: string | null;
}

/**
 * Entraînement ajouté par l'athlète, à la date de son choix (passée ou à
 * venir). Une séance passée enchaîne sur son retour ; elle ne compte dans les
 * données de la semaine qu'une fois ce retour validé par le coach.
 */
export function AthleteTrainingForm({
  existing,
  defaultDate,
  onDone,
  onCancel,
}: {
  existing?: AthleteTrainingExisting;
  defaultDate?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const today = toISODate(new Date());
  const initialSport = existing ? (existing.sport === "cycling" ? "mtb" : existing.sport) : "mtb";
  const [sport, setSport] = useState(initialSport);
  const [sportTouched, setSportTouched] = useState(!!existing);
  const [mtb, setMtb] = useState<string | null>(existing?.discipline && existing.discipline !== "mtb" ? existing.discipline : null);
  const [mtbTouched, setMtbTouched] = useState(!!existing?.discipline);
  const [dates, setDates] = useState<string[]>(existing ? [existing.date] : defaultDate ? [defaultDate] : []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Étape 2 : retour d'une séance passée, juste après l'avoir ajoutée.
  const [retour, setRetour] = useState<{ id: string; sport: string; discipline: string | null; initial: StatusInitial } | null>(null);
  const singleDay = dates.length === 1;
  const past = dates.some((d) => d <= today);
  const outdoor = ELEVATION_SPORTS.includes(sport) && !(sport === "mtb" && mtb && INDOOR_CYCLING.includes(mtb));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dates.length) return setError("Choisis au moins un jour.");
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title") || ""),
      sport,
      discipline: sport === "mtb" ? mtb : null,
      dates,
      time: singleDay ? String(fd.get("time") || "") : "",
      durationMinutes: Number(fd.get("durationMinutes") || 0) || undefined,
      elevationGainM: Number(fd.get("elevationGainM") || 0) || undefined,
      routeUrl: String(fd.get("routeUrl") || ""),
      description: String(fd.get("description") || ""),
    };
    setPending(true);
    setError(undefined);
    try {
      if (existing) {
        await updateAthleteTrainingAction(existing.id, input);
        onDone();
      } else {
        const { ids } = await createAthleteTrainingAction(input);
        if (dates.length === 1 && dates[0] <= today && ids[0]) {
          // Le retour reprend ce qui vient d'être saisi (durée, dénivelé, parcours).
          setRetour({
            id: ids[0],
            sport: sport === "mtb" ? "cycling" : sport,
            discipline: sport === "mtb" ? mtb : null,
            initial: { actualMin: input.durationMinutes ?? null, elevation: input.elevationGainM ?? null, routeUrl: input.routeUrl || null },
          });
        } else onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
    setPending(false);
  }

  if (retour) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-[#eef2f1] px-3 py-2.5 text-[13.5px] text-ink-soft">
          Entraînement ajouté. Fais ton retour : il comptera dans les données de la semaine une fois validé par ton coach.
        </p>
        <StatusForm workoutId={retour.id} currentStatus="planned" sport={retour.sport} discipline={retour.discipline} initial={retour.initial} onDone={onDone} />
        <button type="button" onClick={onDone} className="self-start text-sm font-semibold text-slate underline underline-offset-2">
          Plus tard
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <Field
        label="Titre"
        name="title"
        required
        maxLength={120}
        defaultValue={existing?.title}
        placeholder="Sortie club, séance piste, muscu…"
        onChange={(e) => {
          const g = guessSportFromTitle(e.target.value);
          if (!sportTouched && g) setSport(g === "cycling" ? "mtb" : g);
          const m = guessMtbFromTitle(e.target.value);
          if (!mtbTouched && m) setMtb(m);
        }}
      />
      <SelectField
        label="Sport"
        value={sport}
        onChange={(e) => {
          setSport(e.target.value);
          setSportTouched(true);
        }}
      >
        {TRAINING_SPORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </SelectField>
      {sport === "mtb" && (
        <MtbPicker
          value={mtb}
          onChange={(v) => {
            setMtb(v);
            setMtbTouched(true);
          }}
        />
      )}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
        <DaysPicker value={dates} onChange={setDates} />
        {past && !existing && (
          <p className="mt-2 text-[12.5px] text-slate">
            {singleDay
              ? "Jour passé : tu feras ton retour juste après."
              : "Jours passés : fais ensuite le retour de chaque séance depuis le calendrier."}{" "}
            Ça comptera dans les données de la semaine une fois ton retour validé par ton coach.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {singleDay && <Field label="Heure (facultatif)" type="time" name="time" defaultValue={existing?.time ?? ""} />}
        <SessionDurationInput label={past ? "Durée" : "Durée prévue"} name="durationMinutes" defaultMinutes={existing?.durationMinutes ?? null} />
        {outdoor && <Field label="Dénivelé + (m)" type="number" name="elevationGainM" min={0} step={1} defaultValue={existing?.elevationGainM ?? ""} placeholder="ex. 800" />}
        {outdoor && (
          <div className="col-span-2">
            <RouteUrlField defaultValue={existing?.routeUrl ?? undefined} />
          </div>
        )}
      </div>
      <TextAreaField label="Contenu (facultatif)" name="description" rows={3} defaultValue={existing?.description ?? ""} placeholder="Ce que tu as prévu ou fait : échauffement, blocs, sensations…" />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {existing ? "Enregistrer" : dates.length > 1 ? `Ajouter (${dates.length} jours)` : "Ajouter l'entraînement"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
