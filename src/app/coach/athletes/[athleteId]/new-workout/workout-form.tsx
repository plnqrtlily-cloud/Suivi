"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkoutAction, updateWorkoutAction, saveWorkoutTemplateAction, createWorkoutBulkAction } from "@/lib/actions";
import { Field, SelectField, TextAreaField, Button, ErrorText } from "@/components/ui";
import { DateRangePicker, dateRangeToList } from "@/components/date-range-picker";
import { StrengthBuilder, BlockRow, LibraryResource } from "./strength-builder";

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

const SPORTS = [
  { value: "running", label: "Course à pied" },
  { value: "cycling", label: "Vélo (Route/VTT/BMX)" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
];

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
}: {
  athleteId: string;
  resources: LibraryResource[];
  exerciseHistory: string[];
  exerciseMaxes?: Record<string, number>;
  templates?: WorkoutTemplateOption[];
  otherAthletes?: OtherAthleteOption[];
  initial?: WorkoutFormInitial;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sport, setSport] = useState(initial?.sport ?? "running");
  const [category, setCategory] = useState(initial?.category ?? "entrainement");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [blocks, setBlocks] = useState<BlockRow[]>(initial?.blocks ?? []);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  // Filtre facultatif appliqué à la plage de dates : ex. cocher Lun/Mer/Ven sur
  // une plage de 4 semaines pour ne créer la séance que ces jours-là plutôt que
  // tous les jours consécutifs de la plage.
  const [weekdayFilter, setWeekdayFilter] = useState<number[]>([]);
  const [alsoSendTo, setAlsoSendTo] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  // Charger un modèle réécrit sport/catégorie/couleur (état contrôlé) et force
  // le remontage des champs non contrôlés (titre, durée, description, blocs)
  // via ce compteur utilisé comme clé — leur `defaultValue` ne se réappliquerait
  // pas sinon après le montage initial.
  const [appliedTemplate, setAppliedTemplate] = useState<WorkoutTemplateOption | null>(null);
  const [templateKey, setTemplateKey] = useState(0);
  const [templatePending, setTemplatePending] = useState(false);

  function applyTemplate(id: string) {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    setAppliedTemplate(tpl);
    setSport(tpl.sport);
    setCategory(tpl.category);
    setColor(tpl.color);
    setBlocks(
      tpl.blocks.map((b) => ({
        key: crypto.randomUUID(),
        block_type: b.block_type,
        exercise_name: b.exercise_name,
        notes: b.notes || "",
        resource_id: b.resource_id || "",
        training_quality: (b.training_quality as BlockRow["training_quality"]) || "",
        sets: (b.sets && b.sets.length ? b.sets : [{}]).map((s) => ({
          reps: s.reps || "",
          load: s.load || "",
          restSeconds: s.restSeconds ? String(s.restSeconds) : "",
          rpe: s.rpe ? String(s.rpe) : "",
        })),
      }))
    );
    setTemplateKey((k) => k + 1);
  }

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
        durationMinutes: formData.get("duration") ? Number(formData.get("duration")) : undefined,
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
      ? blocks.map((b) => ({
          block_type: b.block_type,
          exercise_name: b.exercise_name,
          notes: b.notes || undefined,
          resource_id: b.resource_id || undefined,
          training_quality: b.training_quality || undefined,
          sets: b.sets
            .filter((s) => s.reps || s.load)
            .map((s) => ({
              reps: s.reps,
              load: s.load,
              restSeconds: s.restSeconds ? Number(s.restSeconds) : undefined,
              rpe: s.rpe ? Number(s.rpe) : undefined,
            })),
        }))
      : undefined;
  }

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
          durationMinutes: formData.get("duration") ? Number(formData.get("duration")) : undefined,
          description: String(formData.get("description") || ""),
          color,
          blocks: blocksPayload(),
        });
        router.push(`/workouts/${initial.workoutId}`);
      } catch (err: any) {
        setError(err.message || "Une erreur est survenue.");
        setPending(false);
      }
      return;
    }

    if (!rangeStart || !rangeEnd) {
      setError("Choisissez au moins un jour dans le calendrier.");
      return;
    }
    setPending(true);
    setError(undefined);
    let dates = dateRangeToList(rangeStart, rangeEnd);
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
        durationMinutes: formData.get("duration") ? Number(formData.get("duration")) : undefined,
        description: String(formData.get("description") || ""),
        color,
        blocks: blocksPayload(),
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
          durationMinutes: formData.get("duration") ? Number(formData.get("duration")) : undefined,
          description: String(formData.get("description") || ""),
          color,
          blocks: blocksPayload(),
        });
      }
      router.push(dates.length === 1 && alsoSendTo.length === 0 ? `/workouts/${result.workoutIds[0]}` : `/coach/athletes/${athleteId}`);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {!initial && templates && templates.length > 0 && (
        <SelectField label="Charger un modèle (facultatif)" value={appliedTemplate?.id ?? ""} onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">Partir de zéro</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      )}

      <SelectField label="Sport" value={sport} onChange={(e) => setSport(e.target.value)}>
        {SPORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-4">
        <Field
          key={`title-${templateKey}`}
          label="Titre de la séance"
          name="title"
          required
          placeholder="ex. Sortie longue endurance"
          defaultValue={appliedTemplate?.name ?? initial?.title}
        />
        <SelectField label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </div>

      {(category === "objectif" || category === "evenement") && (
        <SelectField
          label="Priorité"
          name="priority"
          defaultValue={initial?.priority ?? ""}
        >
          <option value="">Non définie</option>
          <option value="A">A — Objectif principal (l'affûtage se planifie autour de cette date)</option>
          <option value="B">B — Objectif secondaire</option>
          <option value="C">C — Sortie de calage / test</option>
        </SelectField>
      )}

      {initial ? (
        <Field label="Jour" type="date" name="date" required defaultValue={initial.date} />
      ) : (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
          <p className="mb-2 text-xs text-slate">
            Cliquez un jour pour une séance unique, ou un deuxième jour pour répéter la même séance sur toute la période
            (comme sur Booking pour un séjour).
          </p>
          <DateRangePicker start={rangeStart} end={rangeEnd} onChange={({ start, end }) => { setRangeStart(start); setRangeEnd(end); }} />

          {rangeStart && rangeEnd && rangeStart !== rangeEnd && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-ink-soft">
                Ne répéter que certains jours de la semaine (facultatif — sinon tous les jours de la plage)
              </p>
              <div className="flex flex-wrap gap-2">
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
                    onClick={() =>
                      setWeekdayFilter((prev) => (prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]))
                    }
                    className={`rounded-full border px-3 py-1 text-xs ${
                      weekdayFilter.includes(d.value) ? "border-gold-light bg-gold-light/10 text-ink" : "border-line text-slate"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {otherAthletes && otherAthletes.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Envoyer aussi à d&apos;autres athlètes (facultatif)</p>
              <div className="flex flex-wrap gap-2">
                {otherAthletes.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAlsoSendTo((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      alsoSendTo.includes(a.id) ? "border-gold-light bg-gold-light/10 text-ink" : "border-line text-slate"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Heure (facultatif)" type="time" name="time" defaultValue={initial?.time ?? ""} />
        <Field
          key={`duration-${templateKey}`}
          label="Durée prévue (minutes)"
          type="number"
          name="duration"
          min={0}
          defaultValue={appliedTemplate?.duration_minutes ?? initial?.durationMinutes ?? ""}
        />
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-soft">Couleur</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full border-2"
              style={{ backgroundColor: c, borderColor: color === c ? "#182220" : "transparent" }}
              aria-label={`Choisir la couleur ${c}`}
            />
          ))}
        </div>
      </label>

      {sport === "strength" ? (
        <div>
          <p className="mb-3 text-sm font-medium text-ink-soft">Structure de la séance</p>
          <StrengthBuilder
            key={`sb-${templateKey}`}
            onChange={setBlocks}
            resources={resources}
            exerciseHistory={exerciseHistory}
            initialBlocks={blocks}
            exerciseMaxes={exerciseMaxes}
          />
        </div>
      ) : (
        <TextAreaField
          key={`description-${templateKey}`}
          label="Description de la séance"
          name="description"
          rows={5}
          placeholder="Détail des allures, intervalles, parcours, consignes techniques…"
          defaultValue={appliedTemplate?.description ?? initial?.description ?? ""}
        />
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (initial ? "Enregistrement…" : "Envoi…") : initial ? "Enregistrer les modifications" : "Envoyer la séance"}
        </Button>
        {!initial && (
          <Button type="button" variant="ghost" onClick={handleSaveAsTemplate} disabled={templatePending}>
            {templatePending ? "Enregistrement…" : "Enregistrer comme modèle"}
          </Button>
        )}
      </div>
    </form>
  );
}
