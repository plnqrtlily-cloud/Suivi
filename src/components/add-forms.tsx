"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addImportedActivityAction, addAvailabilityBlockAction, addJournalEntryAction, addCycleEntryAction } from "@/lib/actions";
import { reportHealthAction } from "@/lib/health-actions";
import { Button, Field, SelectField, TextAreaField, ErrorText } from "@/components/ui";
import { AVAILABILITY_SLOT_LABELS } from "@/lib/time-of-day";
import { DateRangePicker, dateRangeToList } from "@/components/date-range-picker";
import { PainScale } from "@/components/pain-scale";
import type { HealthCategory, TrainingImpact } from "@/lib/health";

// Formulaires des ajouts de l'athlète (onglet + et bouton Ajouter du
// calendrier) : chacun choisit lui-même sa date, rien n'est pré-supposé.

export const DONE_SPORTS = [
  { value: "running", label: "Course à pied" },
  { value: "cycling", label: "Vélo" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
  { value: "other", label: "Autre" },
];

function useSubmit(onDone: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  async function run(fn: () => Promise<void | { error: string } | unknown>) {
    setPending(true);
    setError(undefined);
    try {
      const res = await fn();
      if (res && typeof res === "object" && "error" in res) {
        setError(String((res as { error: string }).error));
        setPending(false);
        return;
      }
      setPending(false);
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPending(false);
    }
  }
  return { pending, error, setError, run };
}

function DaysField({ start, end, onChange, hint }: { start: string | null; end: string | null; onChange: (s: string | null, e: string | null) => void; hint: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
      <p className="mb-2 text-xs text-slate">{hint}</p>
      <DateRangePicker start={start} end={end} onChange={({ start, end }) => onChange(start, end)} />
    </div>
  );
}

export function DoneActivityForm({ defaultDate, onDone, onCancel }: { defaultDate?: string; onDone: () => void; onCancel?: () => void }) {
  const [sport, setSport] = useState("running");
  const [start, setStart] = useState<string | null>(defaultDate ?? null);
  const [end, setEnd] = useState<string | null>(defaultDate ?? null);
  const { pending, error, setError, run } = useSubmit(onDone);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!start || !end) return setError("Choisissez au moins un jour.");
        const formData = new FormData(e.currentTarget);
        formData.set("sport", sport);
        const dates = dateRangeToList(start, end);
        // Une activité par jour de la plage : chacune reste modifiable seule.
        run(() =>
          Promise.all(
            dates.map((date) => {
              const perDay = new FormData();
              formData.forEach((v, k) => perDay.set(k, v));
              perDay.set("activityDate", date);
              return addImportedActivityAction(perDay);
            })
          )
        );
      }}
    >
      <DaysField start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} hint="Touchez un jour, ou un second pour couvrir une période (stage, trek…)." />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Heure (facultatif)" type="time" name="activityTime" />
        <SelectField label="Sport" value={sport} onChange={(e) => setSport(e.target.value)}>
          {DONE_SPORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <Field label="Durée (min)" type="number" name="durationMinutes" min={0} />
        {sport !== "strength" && <Field label="Distance (km)" type="number" step="0.1" name="distanceKm" min={0} />}
        <Field label="FC moyenne (bpm)" type="number" name="avgHr" min={0} />
        {(sport === "running" || sport === "cycling" || sport === "hiking") && <Field label="Dénivelé + (m)" type="number" name="elevationGainM" min={0} />}
        {sport === "cycling" && <Field label="Puissance moy. (W)" type="number" name="avgPowerW" min={0} />}
        <Field label="RPE ressenti (1-10)" type="number" name="rpe" min={1} max={10} />
      </div>
      <TextAreaField label="Notes (facultatif)" name="notes" rows={2} placeholder="Sensations, contexte…" />
      <ErrorText>{error}</ErrorText>
      <FormButtons pending={pending} onCancel={onCancel} />
    </form>
  );
}

export function UnavailabilityForm({ defaultDate, onDone, onCancel }: { defaultDate?: string; onDone: () => void; onCancel?: () => void }) {
  const [start, setStart] = useState<string | null>(defaultDate ?? null);
  const [end, setEnd] = useState<string | null>(defaultDate ?? null);
  const { pending, error, setError, run } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!start || !end) return setError("Choisissez au moins un jour.");
        const fd = new FormData(e.currentTarget);
        run(() =>
          addAvailabilityBlockAction({
            dates: dateRangeToList(start, end),
            timeOfDay: String(fd.get("timeOfDay") || "full_day"),
            reason: String(fd.get("reason") || ""),
          })
        );
      }}
    >
      <DaysField start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} hint="Touchez un jour, ou un second pour couvrir une période (déplacement, vacances…)." />
      <SelectField label="Moment" name="timeOfDay" defaultValue="full_day">
        {Object.entries(AVAILABILITY_SLOT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <Field label="Motif (facultatif)" name="reason" placeholder="Déplacement, travail, repos…" />
      <ErrorText>{error}</ErrorText>
      <FormButtons pending={pending} onCancel={onCancel} />
    </form>
  );
}

export function JournalNoteForm({ defaultDate, onDone, onCancel }: { defaultDate: string; onDone: () => void; onCancel?: () => void }) {
  const { pending, error, run } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => addJournalEntryAction(fd));
      }}
    >
      <Field label="Jour" type="date" name="entryDate" required defaultValue={defaultDate} />
      <TextAreaField label="Note" name="content" rows={4} required placeholder="Sensations, contexte, fatigue…" />
      <ErrorText>{error}</ErrorText>
      <FormButtons pending={pending} onCancel={onCancel} />
    </form>
  );
}

export function PeriodForm({ defaultDate, onDone, onCancel }: { defaultDate: string; onDone: () => void; onCancel?: () => void }) {
  const [type, setType] = useState<"period_start" | "period_end">("period_start");
  const { pending, error, run } = useSubmit(onDone);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("entryType", type);
        run(() => addCycleEntryAction(fd));
      }}
    >
      <Segmented
        value={type}
        onChange={(v) => setType(v as typeof type)}
        options={[
          { value: "period_start", label: "Début des règles" },
          { value: "period_end", label: "Fin des règles" },
        ]}
      />
      <Field label="Jour" type="date" name="entryDate" required defaultValue={defaultDate} />
      <ErrorText>{error}</ErrorText>
      <FormButtons pending={pending} onCancel={onCancel} />
    </form>
  );
}

const IMPACTS: { value: TrainingImpact; label: string }[] = [
  { value: "normal", label: "Normalement" },
  { value: "gene", label: "Avec gêne" },
  { value: "stop", label: "Pas du tout" },
];

export function HealthReportForm({
  defaultDate,
  coachName,
  onDone,
}: {
  defaultDate: string;
  coachName: string;
  onDone: (id?: string) => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<HealthCategory>("blessure");
  const [pain, setPain] = useState<number | null>(null);
  const [impact, setImpact] = useState<TrainingImpact | null>(null);
  const [doctor, setDoctor] = useState<"" | "1" | "0">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const titleLabel = category === "blessure" ? "Où ?" : category === "maladie" ? "Quoi ?" : "Ce qui se passe";
  const titlePh = category === "blessure" ? "ex. Genou gauche, à l'extérieur" : category === "maladie" ? "ex. Rhume, fièvre…" : "ex. Voyage, mal dormi…";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("category", category);
    if (pain != null) fd.set("pain", String(pain));
    if (impact) fd.set("trainingImpact", impact);
    if (doctor) fd.set("doctorSeen", doctor);
    setPending(true);
    setError(undefined);
    try {
      const res = await reportHealthAction(fd);
      setPending(false);
      if ("error" in res) return setError(res.error);
      onDone(res.id);
      router.push(`/sante/${res.id}`);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <form key={category} className="flex flex-col gap-4" onSubmit={submit}>
      <Segmented
        value={category}
        onChange={(v) => setCategory(v as HealthCategory)}
        options={[
          { value: "blessure", label: "Blessure" },
          { value: "maladie", label: "Maladie" },
          { value: "etat", label: "État" },
        ]}
      />
      <Field label={titleLabel} name="title" required placeholder={titlePh} />
      {category === "blessure" && <PainScale value={pain} onChange={setPain} />}
      {category === "etat" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Du" type="date" name="dateStart" required defaultValue={defaultDate} />
          <Field label="Au (facultatif)" type="date" name="dateEnd" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Depuis" type="date" name="dateStart" required defaultValue={defaultDate} />
          {category === "blessure" ? (
            <Field label="Comment (facultatif)" name="detail" placeholder="ex. Chute en descente" />
          ) : (
            <SelectField label="Médecin vu" value={doctor} onChange={(e) => setDoctor(e.target.value as typeof doctor)}>
              <option value="">—</option>
              <option value="1">Oui</option>
              <option value="0">Non</option>
            </SelectField>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-ink">Je peux m&apos;entraîner ?</span>
        <div className="flex flex-wrap gap-1.5">
          {IMPACTS.map((i) => (
            <button
              key={i.value}
              type="button"
              aria-pressed={impact === i.value}
              onClick={() => setImpact(i.value)}
              className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${
                impact === i.value ? "border-moss-dark bg-moss-dark text-white" : "border-line bg-white text-ink"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <TextAreaField label="Précisions (facultatif)" name="notes" rows={2} placeholder="Ce que ton coach doit savoir…" />
      <ErrorText>{error}</ErrorText>
      <button type="submit" disabled={pending} className="rounded-xl bg-moss-dark py-3 text-base font-bold text-white disabled:opacity-50">
        {pending ? "Envoi…" : `Prévenir ${coachName}`}
      </button>
    </form>
  );
}

export function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex gap-1 rounded-xl bg-paper-dim p-[3px]" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[10px] px-2 py-2 text-sm font-bold transition-colors ${value === o.value ? "bg-white text-ink shadow-sm" : "text-slate"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FormButtons({ pending, onCancel }: { pending: boolean; onCancel?: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
      )}
    </div>
  );
}
