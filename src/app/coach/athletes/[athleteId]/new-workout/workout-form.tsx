"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkoutAction, updateWorkoutAction, saveWorkoutTemplateAction, createWorkoutBulkAction } from "@/lib/actions";
import { Button, ErrorText } from "@/components/ui";
import { DateRangePicker, dateRangeToList } from "@/components/date-range-picker";
import { StrengthBuilder, BlockRow, LibraryResource, sortBlocksByGroupOrder } from "./strength-builder";
import type { IntervalItem } from "./interval-builder";
import { StructureBuilder, toBlocs, defaultStructure, adaptStructure, type BlocItem, type StructureItem, type ZoneLabels } from "./structure-builder";
import { ACTIVITIES, PLAN_FIELDS, activityById, activityForSport, parsePlan, type PlanKey } from "@/lib/discipline";
import { TIME_OF_DAY_ORDER, TIME_OF_DAY_LABELS, isTimeOfDaySlug, type TimeOfDay } from "@/lib/time-of-day";

type TimeMode = "none" | "precise" | TimeOfDay;

function initialTimeMode(time: string | null | undefined): TimeMode {
  if (!time) return "none";
  return isTimeOfDaySlug(time) ? time : "precise";
}

interface TemplateBlockInput {
  block_type: string;
  exercise_name: string;
  notes?: string;
  resource_id?: string;
  training_quality?: string;
  sets?: { reps?: string; load?: string; restSeconds?: number; rpe?: number }[];
}

export interface WorkoutTemplateOption {
  id: string;
  name: string;
  sport: string;
  category: string;
  duration_minutes: number | null;
  description: string | null;
  color: string;
  blocks: TemplateBlockInput[];
}


const CATEGORIES = [
  { value: "entrainement", label: "Entraînement" },
  { value: "objectif", label: "Objectif" },
  { value: "evenement", label: "Événement / compétition" },
  { value: "divers", label: "Divers" },
];

// Repris de la palette du produit (globals.css) plutôt que de teintes ad hoc.
const COLORS = ["#1B4B4F", "#E8896A", "#7C5C46", "#5B6660", "#6B7A8A"];

export interface WorkoutFormInitial {
  workoutId: string;
  sport: string;
  category: string;
  priority: string | null;
  title: string;
  date: string;
  time: string | null;
  durationMinutes: number | null;
  description: string | null;
  color: string;
  blocks: BlockRow[];
  intervals: IntervalItem[];
  links: { label: string; url: string }[];
  plannedRpe?: number | null;
  planJson?: string | null;
}

export interface OtherAthleteOption {
  id: string;
  name: string;
}

export function WorkoutForm({
  athleteId,
  resources,
  exerciseHistory,
  exerciseMaxes,
  templates,
  otherAthletes,
  initial,
  defaultDate,
  zones,
}: {
  athleteId: string;
  resources: LibraryResource[];
  exerciseHistory: string[];
  exerciseMaxes?: Record<string, number>;
  templates?: WorkoutTemplateOption[];
  otherAthletes?: OtherAthleteOption[];
  initial?: WorkoutFormInitial;
  defaultDate?: string;
  zones?: ZoneLabels;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const initialPlan = parsePlan(initial?.planJson);
  const [activityId, setActivityId] = useState(initial ? activityForSport(initial.sport, initialPlan).id : "running");
  const activity = activityById(activityId);
  const sport = activity.sport;
  const [planValues, setPlanValues] = useState<Partial<Record<PlanKey, string>>>(initialPlan?.values ?? {});
  const [plannedRpe, setPlannedRpe] = useState(initial?.plannedRpe ? String(initial.plannedRpe) : "");
  const [duration, setDuration] = useState(initial?.durationMinutes ? String(initial.durationMinutes) : "");
  const [structure, setStructure] = useState<BlocItem[]>(() => {
    const init = (initial?.intervals ?? []) as unknown as StructureItem[];
    return init.length ? toBlocs(init) : defaultStructure(activityForSport(initial?.sport ?? "running", initialPlan));
  });
  const [category, setCategory] = useState(initial?.category ?? "entrainement");
  // Le coach ne connaît pas toujours l'heure exacte d'une séance à venir —
  // seulement "le matin" ou "en soirée". Le créneau choisi part directement
  // dans workouts.time à la place d'une heure "HH:MM" (cf. lib/time-of-day.ts),
  // sans changement de schéma ni d'action serveur nécessaire.
  const [timeMode, setTimeMode] = useState<TimeMode>(initialTimeMode(initial?.time));
  const [preciseTime, setPreciseTime] = useState(initial?.time && !isTimeOfDaySlug(initial.time) ? initial.time : "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [blocks, setBlocks] = useState<BlockRow[]>(initial?.blocks ?? []);
  const [links, setLinks] = useState<{ label: string; url: string }[]>(initial?.links ?? []);
  const [rangeStart, setRangeStart] = useState<string | null>(defaultDate ?? null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(defaultDate ?? null);
  // Filtre facultatif appliqué à la plage de dates : ex. cocher Lun/Mer/Ven sur
  // une plage de 4 semaines pour ne créer la séance que ces jours-là plutôt que
  // tous les jours consécutifs de la plage.
  const [weekdayFilter, setWeekdayFilter] = useState<number[]>([]);
  const [alsoSendTo, setAlsoSendTo] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  // Rempli par le bouton cliqué : une séance en brouillon n'est pas visible
  // par l'athlète et ne déclenche aucune notification tant qu'elle n'est pas publiée.
  const draftRef = useRef(false);
  // Charger un modèle réécrit sport/catégorie/couleur (état contrôlé) et force
  // le remontage des champs non contrôlés (titre, durée, description, blocs)
  // via ce compteur utilisé comme clé — leur `defaultValue` ne se réappliquerait
  // pas sinon après le montage initial.
  const [appliedTemplate, setAppliedTemplate] = useState<WorkoutTemplateOption | null>(null);
  const [templateKey, setTemplateKey] = useState(0);
  const [templatePending, setTemplatePending] = useState(false);



  async function handleSaveAsTemplate() {
    const name = window.prompt("Nom du modèle (ex. \"Bloc force bas du corps\") :");
    if (!name || !formRef.current) return;
    setTemplatePending(true);
    const formData = new FormData(formRef.current);
    try {
      await saveWorkoutTemplateAction({
        name,
        sport,
        category,
        durationMinutes: duration ? Number(duration) : undefined,
        description: String(formData.get("description") || ""),
        color,
        blocks: blocksPayload(),
      });
      router.refresh();
    } finally {
      setTemplatePending(false);
    }
  }

  function blocksPayload() {
    return sport === "strength"
      ? sortBlocksByGroupOrder(blocks).map((b) => ({
          block_type: b.block_type,
          exercise_name: b.exercise_name,
          notes: b.notes || undefined,
          resource_id: b.resource_id || undefined,
          training_quality: b.training_quality || undefined,
          rep_type: b.rep_type,
          circuit_id: b.circuit_id,
          circuit_rounds: b.circuit_rounds,
          circuit_rest_seconds: b.circuit_rest_seconds,
          sets: b.sets
            .filter((s) => s.reps || s.load)
            .map((s) => ({
              reps: s.reps,
              load: s.load,
              restSeconds: s.restSeconds ? Number(s.restSeconds) : undefined,
              rpe: s.rpe ? Number(s.rpe) : undefined,
              rir: s.rir ? Number(s.rir) : undefined,
            })),
        }))
      : undefined;
  }

  // Structure nettoyée (étapes sans durée ni cible gardées : le coach peut
  // vouloir une étape « au ressenti ») et objectifs propres à la discipline.
  function structureJson(): string | undefined {
    if (sport === "strength") return undefined;
    const kept = structure.filter((b) => b.items.length > 0);
    return kept.length ? JSON.stringify(kept) : undefined;
  }
  function planJson(): string {
    const values: Partial<Record<PlanKey, string>> = {};
    for (const k of activity.plan) if (planValues[k]?.trim()) values[k] = planValues[k]!.trim();
    return JSON.stringify({ activity: activity.id, values });
  }
  const rpeNumber = plannedRpe ? Number(plannedRpe) : undefined;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (initial) {
      const date = String(formData.get("date") || "");
      if (!date) {
        setError("Choisissez un jour.");
        return;
      }
      setPending(true);
      setError(undefined);
      try {
        await updateWorkoutAction({
          workoutId: initial.workoutId,
          sport,
          category,
          priority: String(formData.get("priority") || ""),
          title: String(formData.get("title")),
          date,
          time: String(formData.get("time") || ""),
          durationMinutes: duration ? Number(duration) : undefined,
          description: String(formData.get("description") || ""),
          color,
          blocks: blocksPayload(),
          intervalsJson: structureJson(),
          plannedRpe: rpeNumber,
          planJson: planJson(),
          linksJson: JSON.stringify(links.filter((l) => l.label && l.url)),
        });
        router.push(`/coach/athletes/${athleteId}`);
      } catch (err: any) {
        setError(err.message || "Une erreur est survenue.");
        setPending(false);
      }
      return;
    }

    if (!defaultDate && (!rangeStart || !rangeEnd)) {
      setError("Choisissez au moins un jour dans le calendrier.");
      return;
    }
    setPending(true);
    setError(undefined);
    let dates = defaultDate ? [defaultDate] : dateRangeToList(rangeStart!, rangeEnd!);
    // N'applique le filtre que si au moins un jour est coché ET que la plage
    // couvre plusieurs jours — sur un jour unique, le filtre n'aurait pas de sens.
    if (weekdayFilter.length > 0 && dates.length > 1) {
      dates = dates.filter((d) => weekdayFilter.includes(new Date(`${d}T00:00:00`).getDay()));
      if (dates.length === 0) {
        setError("Aucun jour de la plage sélectionnée ne correspond aux jours de semaine cochés.");
        setPending(false);
        return;
      }
    }
    try {
      const result = await createWorkoutAction({
        athleteId,
        sport,
        category,
        priority: String(formData.get("priority") || ""),
        title: String(formData.get("title")),
        dates,
        time: String(formData.get("time") || ""),
        durationMinutes: duration ? Number(duration) : undefined,
        description: String(formData.get("description") || ""),
        color,
        blocks: blocksPayload(),
        intervalsJson: structureJson(),
          plannedRpe: rpeNumber,
          planJson: planJson(),
        linksJson: JSON.stringify(links.filter((l) => l.label && l.url)),
        isDraft: draftRef.current,
      });
      if (alsoSendTo.length > 0) {
        await createWorkoutBulkAction({
          athleteIds: alsoSendTo,
          sport,
          category,
          priority: String(formData.get("priority") || ""),
          title: String(formData.get("title")),
          dates,
          time: String(formData.get("time") || ""),
          durationMinutes: duration ? Number(duration) : undefined,
          description: String(formData.get("description") || ""),
          color,
          blocks: blocksPayload(),
          intervalsJson: structureJson(),
          plannedRpe: rpeNumber,
          planJson: planJson(),
          linksJson: JSON.stringify(links.filter((l) => l.label && l.url)),
        });
      }
      void result;
      router.push(`/coach/athletes/${athleteId}`);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
      setPending(false);
    }
  }

  const label = "flex flex-col gap-1.5 text-sm font-bold text-ink";
  const input = "rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-moss";
  const section = "flex flex-col gap-4 rounded-2xl bg-white p-5 sm:p-6";
  const slots: { value: TimeMode; label: string }[] = [
    ...TIME_OF_DAY_ORDER.map((slot) => ({ value: slot as TimeMode, label: TIME_OF_DAY_LABELS[slot] })),
    { value: "precise", label: "Heure précise" },
  ];
  const knownDate = initial?.date ?? defaultDate;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {knownDate && <input type="hidden" name="date" value={knownDate} />}

      <section className={section}>
        <h2 className="text-base font-bold text-ink">L&apos;essentiel</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr]">
          <label className={label}>
            Activité
            <select value={activityId} onChange={(e) => { setActivityId(e.target.value); setStructure((st) => adaptStructure(st, activityById(e.target.value))); }} className={input}>
              {ACTIVITIES.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Titre
            <input key={`title-${templateKey}`} name="title" required placeholder={activity.titlePh} defaultValue={appliedTemplate?.name ?? initial?.title} className={input} />
          </label>
          <label className={label}>
            Catégorie
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        {(category === "objectif" || category === "evenement") && (
          <label className={label}>
            Priorité
            <select name="priority" defaultValue={initial?.priority ?? ""} className={input}>
              <option value="">Non définie</option>
              <option value="A">A — Objectif principal (l&apos;affûtage se planifie autour de cette date)</option>
              <option value="B">B — Objectif secondaire</option>
              <option value="C">C — Sortie de calage / test</option>
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className={label}>
            Durée prévue (min)
            <input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" className={input} />
          </label>
          <label className={label}>
            RPE visé
            <input type="number" min={1} max={10} value={plannedRpe} onChange={(e) => setPlannedRpe(e.target.value)} placeholder="1-10" className={input} />
          </label>
          {activity.plan.map((k) => {
            const f = PLAN_FIELDS[k];
            return (
              <label key={k} className={label}>
                {f.label}{f.unit ? ` (${f.unit})` : ""}
                <input
                  inputMode={f.numeric ? "decimal" : "text"}
                  value={planValues[k] ?? ""}
                  onChange={(e) => setPlanValues((v) => ({ ...v, [k]: e.target.value }))}
                  placeholder={f.ph}
                  className={input}
                />
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-ink">
            Moment <span className="text-[13px] font-normal text-slate">facultatif</span>
          </span>
          <div className="flex flex-wrap rounded-full bg-paper-dim p-[3px]">
            {slots.map((sl) => (
              <button
                key={sl.value}
                type="button"
                onClick={() => setTimeMode(timeMode === sl.value ? "none" : sl.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${timeMode === sl.value ? "bg-white text-ink shadow-sm" : "text-slate"}`}
              >
                {sl.label}
              </button>
            ))}
          </div>
          {timeMode === "precise" && (
            <input type="time" value={preciseTime} onChange={(e) => setPreciseTime(e.target.value)} className={input} />
          )}
          <input type="hidden" name="time" value={timeMode === "none" ? "" : timeMode === "precise" ? preciseTime : timeMode} />
        </div>

        {!knownDate && (
          <div>
            <span className="mb-1.5 block text-sm font-bold text-ink">Jour(s)</span>
            <p className="mb-2 text-xs text-slate">Un jour pour une séance unique, ou un deuxième jour pour la répéter sur toute la période.</p>
            <DateRangePicker start={rangeStart} end={rangeEnd} onChange={({ start, end }) => { setRangeStart(start); setRangeEnd(end); }} />
            {rangeStart && rangeEnd && rangeStart !== rangeEnd && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-ink-soft">Seulement certains jours :</span>
                {[
                  { value: 1, label: "Lun" },
                  { value: 2, label: "Mar" },
                  { value: 3, label: "Mer" },
                  { value: 4, label: "Jeu" },
                  { value: 5, label: "Ven" },
                  { value: 6, label: "Sam" },
                  { value: 0, label: "Dim" },
                ].map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setWeekdayFilter((prev) => (prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]))}
                    className={`rounded-full border px-3 py-1 text-xs ${weekdayFilter.includes(d.value) ? "border-moss bg-[#e3eeed] text-ink" : "border-line text-slate"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className={section}>
        <h2 className="text-base font-bold text-ink">Structure de la séance</h2>
        {sport === "strength" ? (
          <StrengthBuilder
            key={`sb-${templateKey}`}
            onChange={setBlocks}
            resources={resources}
            exerciseHistory={exerciseHistory}
            initialBlocks={blocks}
            exerciseMaxes={exerciseMaxes}
          />
        ) : (
          <StructureBuilder items={structure} onChange={setStructure} activity={activity} zones={zones ?? {}} onUseDuration={(m) => setDuration(String(m))} />
        )}
      </section>

      <section className={section}>
        <div className="flex items-baseline">
          <h2 className="text-base font-bold text-ink">Options</h2>
          <span className="flex-1" />
          <span className="text-[13px] text-slate">facultatif</span>
        </div>
        <label className={label}>
          Consignes pour l&apos;athlète
          <textarea
            key={`description-${templateKey}`}
            name="description"
            rows={3}
            placeholder={activity.notesPh}
            defaultValue={appliedTemplate?.description ?? initial?.description ?? ""}
            className={`${input} resize-y`}
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-ink">Liens et ressources</span>
          {links.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Titre (ex. carte du parcours)" className={`${input} flex-1`} />
              <input value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" className={`${input} flex-[2]`} />
              <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Retirer le lien" className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-slate">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className="self-start rounded-[10px] border border-dashed border-[#aab4b1] px-3 py-1.5 text-[13px] font-semibold text-moss">
            + Ajouter un lien
          </button>
        </div>
        {!initial && otherAthletes && otherAthletes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">Envoyer aussi à</span>
            {otherAthletes.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAlsoSendTo((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                className={`rounded-full border px-3 py-1 text-xs ${alsoSendTo.includes(a.id) ? "border-moss bg-[#e3eeed] text-ink" : "border-line text-slate"}`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending} onClick={() => { draftRef.current = false; }}>
          {pending ? (initial ? "Enregistrement…" : "Envoi…") : initial ? "Enregistrer les modifications" : "Programmer la séance"}
        </Button>
        {!initial && (
          <Button type="submit" variant="secondary" disabled={pending} onClick={() => { draftRef.current = true; }}>
            Enregistrer en brouillon
          </Button>
        )}
        {!initial && (
          <Button type="button" variant="ghost" onClick={handleSaveAsTemplate} disabled={templatePending}>
            {templatePending ? "Enregistrement…" : "Enregistrer comme modèle"}
          </Button>
        )}
      </div>
    </form>
  );
}
