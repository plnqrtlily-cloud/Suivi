"use client";

import { useState } from "react";
import { Button, SelectField } from "@/components/ui";
import { COMMON_EXERCISES } from "@/lib/exercise-library";
import type { TrainingQuality } from "@/lib/actions";
import { computeVolume, formatSeconds, resolveLoadKg } from "@/lib/strength-volume";

// Structuration en blocs de la musculation : échauffement (mobilité /
// pliométrie / proprioception) -> corps de séance (principal / secondaire /
// complémentaire / spécifique) -> gainage -> retour au calme.
export const BLOCK_GROUPS: { title: string; types: { value: string; label: string }[] }[] = [
  {
    title: "Échauffement",
    types: [
      { value: "warmup_mobility", label: "Mobilité" },
      { value: "warmup_plyo", label: "Pliométrie" },
      { value: "warmup_proprio", label: "Proprioception" },
    ],
  },
  {
    title: "Corps de séance",
    types: [
      { value: "main", label: "Exercice principal" },
      { value: "secondary", label: "Exercice secondaire" },
      { value: "complementary", label: "Exercice complémentaire" },
      { value: "specific", label: "Exercice spécifique" },
    ],
  },
  { title: "Gainage", types: [{ value: "core", label: "Gainage" }] },
  { title: "Retour au calme", types: [{ value: "cooldown", label: "Retour au calme" }] },
];

// La qualité travaillée ne concerne que le corps de séance : c'est là qu'on
// pilote force max, explosivité ou force-endurance. L'échauffement et le
// retour au calme n'ont pas à porter cette intention.
const QUALITY_GROUP_TITLE = "Corps de séance";

const QUALITY_OPTIONS: { value: TrainingQuality; label: string }[] = [
  { value: "force_max", label: "Force maximale" },
  { value: "explosivite", label: "Explosivité / puissance" },
  { value: "force_endurance", label: "Force-endurance" },
  { value: "cardio", label: "Cardio / conditionnement" },
];

// Repères de prescription par qualité (périodisation classique Bompa/NSCA) :
// les valeurs suggérées changent selon ce qu'on cherche à développer.
const QUALITY_HINTS: Record<TrainingQuality | "default", { reps: string; load: string; rest: string }> = {
  force_max: { reps: "1-5", load: "85-95", rest: "180" },
  explosivite: { reps: "1-6", load: "30-60", rest: "180" },
  force_endurance: { reps: "15-30", load: "40-60", rest: "45" },
  cardio: { reps: "30", load: "—", rest: "60" },
  default: { reps: "8-10", load: "70", rest: "90" },
};

export interface SetRow {
  reps: string;
  load: string;
  restSeconds: string;
  rpe: string;
  rir: string;
}

export interface BlockRow {
  key: string;
  block_type: string;
  exercise_name: string;
  notes: string;
  resource_id: string;
  training_quality: TrainingQuality | "";
  rep_type: "reps" | "time";
  /** Exercices partageant cet identifiant = une même série. */
  circuit_id?: string;
  /** Nombre de fois que la série est répétée. */
  circuit_rounds?: number;
  /** Récupération entre deux passages de la série, en secondes. */
  circuit_rest_seconds?: number;
  sets: SetRow[];
}

export interface LibraryResource {
  id: string;
  title: string;
  type: "video" | "photo" | "equipment";
}

function emptySet(): SetRow {
  return { reps: "", load: "", restSeconds: "", rpe: "", rir: "" };
}

function newExercise(blockType: string, seriesId: string, rounds: number, rest: number): BlockRow {
  return {
    key: crypto.randomUUID(),
    block_type: blockType,
    exercise_name: "",
    notes: "",
    resource_id: "",
    training_quality: "",
    rep_type: "reps",
    circuit_id: seriesId,
    circuit_rounds: rounds,
    circuit_rest_seconds: rest,
    sets: [emptySet()],
  };
}

/** "75%" + max connu -> "≈ 75 kg", pour que le coach voie ce qu'il prescrit. */
function loadPreview(load: string, maxKg?: number): string | null {
  if (!load.includes("%") || !maxKg) return null;
  const kg = resolveLoadKg(load, maxKg);
  return kg === null ? null : `≈ ${Math.round(kg)} kg`;
}

export function StrengthBuilder({
  onChange,
  resources,
  exerciseHistory,
  initialBlocks,
  exerciseMaxes,
}: {
  onChange: (blocks: BlockRow[]) => void;
  resources: LibraryResource[];
  exerciseHistory: string[];
  initialBlocks?: BlockRow[];
  exerciseMaxes?: Record<string, number>;
}) {
  const [rows, setRows] = useState<BlockRow[]>(initialBlocks ?? []);
  const [reorderMode, setReorderMode] = useState<Record<string, boolean>>({});
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const attachable = resources.filter((r) => r.type === "video" || r.type === "photo");
  const suggestions = [...new Set([...exerciseHistory, ...COMMON_EXERCISES])].sort();
  const volume = computeVolume(rows, exerciseMaxes ?? {});

  function update(next: BlockRow[]) {
    setRows(next);
    onChange(next);
  }

  function updateRow(key: string, patch: Partial<BlockRow>) {
    update(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function updateSet(key: string, patch: Partial<SetRow>) {
    update(rows.map((r) => (r.key === key ? { ...r, sets: [{ ...r.sets[0], ...patch }] } : r)));
  }

  /** Une série = un groupe d'exercices répété N fois, avec sa récup propre. */
  function addSeries(blockType: string) {
    const seriesId = crypto.randomUUID();
    update([...rows, newExercise(blockType, seriesId, 3, 90)]);
  }

  function addExerciseToSeries(seriesId: string, blockType: string, rounds: number, rest: number) {
    // Insérer juste après le dernier exercice de cette série, pour que l'ordre
    // affiché corresponde à l'ordre d'exécution.
    const lastIdx = rows.map((r) => r.circuit_id).lastIndexOf(seriesId);
    const next = [...rows];
    next.splice(lastIdx + 1, 0, newExercise(blockType, seriesId, rounds, rest));
    update(next);
  }

  function updateSeries(seriesId: string, patch: Partial<BlockRow>) {
    update(rows.map((r) => (r.circuit_id === seriesId ? { ...r, ...patch } : r)));
  }

  function removeSeries(seriesId: string) {
    update(rows.filter((r) => r.circuit_id !== seriesId));
  }

  function removeExercise(key: string) {
    update(rows.filter((r) => r.key !== key));
  }

  function moveExercise(key: string, direction: "up" | "down") {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const siblings = rows.filter((r) => r.circuit_id === row.circuit_id);
    const pos = siblings.indexOf(row);
    const target = direction === "up" ? pos - 1 : pos + 1;
    if (target < 0 || target >= siblings.length) return;
    const i1 = rows.indexOf(row);
    const i2 = rows.indexOf(siblings[target]);
    const next = [...rows];
    [next[i1], next[i2]] = [next[i2], next[i1]];
    update(next);
  }

  function reorderByDrag(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    const dragged = rows.find((r) => r.key === fromKey);
    const target = rows.find((r) => r.key === toKey);
    if (!dragged || !target || dragged.circuit_id !== target.circuit_id) return;
    const without = rows.filter((r) => r.key !== fromKey);
    without.splice(without.findIndex((r) => r.key === toKey), 0, dragged);
    update(without);
  }

  return (
    <div className="flex flex-col gap-5">
      <datalist id="exercise-suggestions">
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* Volume en direct — visible du coach seulement, puisque ce panneau
          n'existe que dans l'écran de construction. */}
      {volume.exerciseCount > 0 && (
        <div className="sticky top-2 z-10 rounded-2xl border border-moss/30 bg-white/95 p-3 shadow-sm backdrop-blur">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">Volume de la séance</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <p className="text-lg font-semibold text-ink">{volume.totalSets}</p>
              <p className="text-[11px] text-slate">séries au total</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">{volume.totalReps || "—"}</p>
              <p className="text-[11px] text-slate">répétitions</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">
                {volume.totalLoadKg ? `${volume.totalLoadKg.toLocaleString("fr-FR")} kg` : "—"}
              </p>
              <p className="text-[11px] text-slate">tonnage</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">{formatSeconds(volume.totalTimeSeconds)}</p>
              <p className="text-[11px] text-slate">travail minuté</p>
            </div>
          </div>
          {volume.hasUnresolvedPercent && (
            <p className="mt-2 text-[11px] text-gold-light">
              Tonnage partiel : certaines charges sont en % sans max testé pour cet exercice.
            </p>
          )}
        </div>
      )}

      {BLOCK_GROUPS.map((group) => {
        const groupRows = rows.filter((r) => group.types.some((t) => t.value === r.block_type));
        const allowsQuality = group.title === QUALITY_GROUP_TITLE;

        // Regrouper les exercices consécutifs d'une même série.
        const series: { id: string; rows: BlockRow[] }[] = [];
        for (const row of groupRows) {
          const last = series[series.length - 1];
          const id = row.circuit_id || row.key;
          if (last && last.id === id) last.rows.push(row);
          else series.push({ id, rows: [row] });
        }

        return (
          <div key={group.title} className="rounded-3xl border border-line bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate">{group.title}</h3>
              <div className="flex gap-2">
                {groupRows.length > 1 && (
                  <Button
                    type="button"
                    variant={reorderMode[group.title] ? "primary" : "secondary"}
                    onClick={() => setReorderMode((m) => ({ ...m, [group.title]: !m[group.title] }))}
                  >
                    {reorderMode[group.title] ? "Terminé" : "↕ Réorganiser"}
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => addSeries(group.types[0].value)}>
                  + Série
                </Button>
              </div>
            </div>

            {groupRows.length === 0 && (
              <p className="text-sm text-slate">Aucune série — ajoutez-en une pour commencer.</p>
            )}

            {reorderMode[group.title] ? (
              <ul className="flex flex-col gap-1.5">
                {groupRows.map((row) => (
                  <li
                    key={row.key}
                    draggable
                    onDragStart={() => setDraggedKey(row.key)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverKey !== row.key) setDragOverKey(row.key);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedKey) reorderByDrag(draggedKey, row.key);
                      setDraggedKey(null);
                      setDragOverKey(null);
                    }}
                    onDragEnd={() => {
                      setDraggedKey(null);
                      setDragOverKey(null);
                    }}
                    className={`flex cursor-grab items-center gap-2 rounded-xl border bg-paper-dim px-3 py-2 text-sm active:cursor-grabbing ${
                      draggedKey === row.key ? "opacity-40" : ""
                    } ${dragOverKey === row.key && draggedKey !== row.key ? "border-moss bg-moss/10" : "border-line"}`}
                  >
                    <span className="text-slate" aria-hidden>
                      ⠿
                    </span>
                    <span className="font-medium text-ink">{row.exercise_name || "(exercice sans nom)"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-4">
                {series.map((s) => {
                  const rounds = s.rows[0]?.circuit_rounds ?? 1;
                  const seriesRest = s.rows[0]?.circuit_rest_seconds ?? 0;
                  const seriesId = s.rows[0]?.circuit_id;

                  return (
                    <div key={s.id} className="rounded-2xl border-2 border-dashed border-moss/40 bg-moss/5 p-3">
                      {/* Niveau SÉRIE : combien de fois, et récup entre chaque passage */}
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-moss-dark">Série</span>
                        <label className="flex items-center gap-1 text-xs text-ink-soft">
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={rounds}
                            onChange={(e) => seriesId && updateSeries(seriesId, { circuit_rounds: Number(e.target.value) })}
                            className="w-14 rounded border border-line px-2 py-1 text-sm"
                          />
                          fois
                        </label>
                        <label className="flex items-center gap-1 text-xs text-ink-soft">
                          récup. entre séries
                          <input
                            type="number"
                            min={0}
                            value={seriesRest || ""}
                            onChange={(e) =>
                              seriesId && updateSeries(seriesId, { circuit_rest_seconds: Number(e.target.value) })
                            }
                            placeholder="90"
                            className="w-16 rounded border border-line px-2 py-1 text-sm"
                          />
                          s
                        </label>
                        {seriesId && s.rows.length > 1 && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-moss-dark">
                            {s.rows.length} exercices enchaînés
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => seriesId && removeSeries(seriesId)}
                          className="ml-auto text-xs text-clay hover:underline"
                        >
                          Retirer la série
                        </button>
                      </div>

                      {/* Niveau EXERCICE */}
                      <div className="flex flex-col gap-3">
                        {s.rows.map((row) => {
                          const hint = QUALITY_HINTS[row.training_quality || "default"];
                          const set = row.sets[0] ?? emptySet();
                          const maxKg = exerciseMaxes?.[row.exercise_name];
                          const preview = loadPreview(set.load, maxKg);
                          const resource = attachable.find((r) => r.id === row.resource_id);

                          return (
                            <div key={row.key} className="rounded-xl bg-white p-3">
                              <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-12">
                                <div className="sm:col-span-4">
                                  <SelectField
                                    label="Type d'exercice"
                                    value={row.block_type}
                                    onChange={(e) => updateRow(row.key, { block_type: e.target.value })}
                                  >
                                    {group.types.map((t) => (
                                      <option key={t.value} value={t.value}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </SelectField>
                                </div>
                                <div className="sm:col-span-6">
                                  <label className="flex flex-col gap-1.5 text-sm">
                                    <span className="font-medium text-ink-soft">
                                      Exercice
                                      {maxKg && <span className="ml-1.5 font-normal text-slate">— max {maxKg} kg</span>}
                                    </span>
                                    <input
                                      list="exercise-suggestions"
                                      value={row.exercise_name}
                                      onChange={(e) => updateRow(row.key, { exercise_name: e.target.value })}
                                      placeholder="Rechercher ou saisir…"
                                      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                                    />
                                  </label>
                                </div>
                                <div className="flex items-end gap-1 sm:col-span-2">
                                  <button
                                    type="button"
                                    onClick={() => moveExercise(row.key, "up")}
                                    disabled={s.rows[0]?.key === row.key}
                                    className="rounded border border-line px-1.5 py-1.5 text-xs text-ink-soft hover:border-moss disabled:opacity-30"
                                    title="Monter"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveExercise(row.key, "down")}
                                    disabled={s.rows[s.rows.length - 1]?.key === row.key}
                                    className="rounded border border-line px-1.5 py-1.5 text-xs text-ink-soft hover:border-moss disabled:opacity-30"
                                    title="Descendre"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeExercise(row.key)}
                                    className="text-xs text-clay hover:underline"
                                  >
                                    Retirer
                                  </button>
                                </div>
                              </div>

                              {allowsQuality && (
                                <div className="mb-2">
                                  <SelectField
                                    label="Qualité travaillée"
                                    value={row.training_quality}
                                    onChange={(e) =>
                                      updateRow(row.key, { training_quality: e.target.value as TrainingQuality | "" })
                                    }
                                  >
                                    <option value="">Non précisée</option>
                                    {QUALITY_OPTIONS.map((q) => (
                                      <option key={q.value} value={q.value}>
                                        {q.label}
                                      </option>
                                    ))}
                                  </SelectField>
                                </div>
                              )}

                              {/* Prescription : répétitions ou durée, charge, récup, RPE, RIR */}
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-xs font-medium text-ink-soft">Prescrit en :</span>
                                <div className="flex overflow-hidden rounded-full border border-line text-xs">
                                  <button
                                    type="button"
                                    onClick={() => updateRow(row.key, { rep_type: "reps" })}
                                    className={`px-3 py-1 ${row.rep_type === "reps" ? "bg-moss text-white" : "text-ink-soft"}`}
                                  >
                                    Répétitions
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateRow(row.key, { rep_type: "time" })}
                                    className={`px-3 py-1 ${row.rep_type === "time" ? "bg-moss text-white" : "text-ink-soft"}`}
                                  >
                                    Durée
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {row.rep_type === "time" ? (
                                  <DurationField
                                    value={set.reps}
                                    onChange={(v) => updateSet(row.key, { reps: v })}
                                  />
                                ) : (
                                  <label className="flex flex-col gap-1 text-xs">
                                    <span className="font-medium text-ink-soft">Répétitions</span>
                                    <input
                                      value={set.reps}
                                      onChange={(e) => updateSet(row.key, { reps: e.target.value })}
                                      placeholder={hint.reps}
                                      className="rounded border border-line px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                )}

                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-medium text-ink-soft">Charge</span>
                                  <input
                                    value={set.load}
                                    onChange={(e) => updateSet(row.key, { load: e.target.value })}
                                    placeholder={`${hint.load}%`}
                                    className="rounded border border-line px-2 py-1.5 text-sm"
                                  />
                                  {preview && <span className="text-[10px] text-moss-dark">{preview}</span>}
                                </label>

                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-medium text-ink-soft">Récup. après (s)</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={set.restSeconds}
                                    onChange={(e) => updateSet(row.key, { restSeconds: e.target.value })}
                                    placeholder="0 = enchaîné"
                                    className="rounded border border-line px-2 py-1.5 text-sm"
                                  />
                                </label>

                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-medium text-ink-soft">RPE</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={set.rpe}
                                    onChange={(e) => updateSet(row.key, { rpe: e.target.value })}
                                    placeholder="1-10"
                                    className="rounded border border-line px-2 py-1.5 text-sm"
                                  />
                                </label>

                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-medium text-ink-soft">RIR</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={set.rir}
                                    onChange={(e) => updateSet(row.key, { rir: e.target.value })}
                                    placeholder="0-5"
                                    className="rounded border border-line px-2 py-1.5 text-sm"
                                  />
                                </label>
                              </div>

                              {/* Ressource de la bibliothèque : aperçu immédiat de ce
                                  qui est attendu, plutôt qu'un nom d'exercice seul. */}
                              <div className="mt-2 flex flex-wrap items-end gap-3">
                                <div className="min-w-[200px] flex-1">
                                  <SelectField
                                    label="Démonstration (bibliothèque)"
                                    value={row.resource_id}
                                    onChange={(e) => updateRow(row.key, { resource_id: e.target.value })}
                                  >
                                    <option value="">Aucune</option>
                                    {attachable.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.type === "video" ? "🎬" : "🖼"} {r.title}
                                      </option>
                                    ))}
                                  </SelectField>
                                </div>
                                {resource && (
                                  <div className="w-28 overflow-hidden rounded-lg border border-line">
                                    {resource.type === "video" ? (
                                      <video className="aspect-video w-full bg-ink" muted>
                                        <source src={`/api/resources/file/${resource.id}`} />
                                      </video>
                                    ) : (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={`/api/resources/file/${resource.id}`}
                                        alt={resource.title}
                                        className="aspect-video w-full object-cover"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>

                              <input
                                value={row.notes}
                                onChange={(e) => updateRow(row.key, { notes: e.target.value })}
                                placeholder="Consigne technique (facultatif)"
                                className="mt-2 w-full rounded border border-line px-2 py-1.5 text-sm"
                              />
                            </div>
                          );
                        })}
                      </div>

                      {seriesId && (
                        <button
                          type="button"
                          onClick={() => addExerciseToSeries(seriesId, group.types[0].value, rounds, seriesRest)}
                          className="mt-3 text-xs font-medium text-moss-dark hover:underline"
                        >
                          + Exercice dans cette série
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Durée en nombre + unité, plutôt qu'un format à taper à la main. */
function DurationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const match = (value || "").trim().match(/^(\d+)\s*(min|s)$/);
  const amount = match ? match[1] : "";
  const unit = match ? (match[2] as "min" | "s") : "s";

  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-ink-soft">Durée</span>
      <span className="flex gap-1">
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => onChange(e.target.value ? `${e.target.value} ${unit}` : "")}
          placeholder="45"
          className="w-full rounded border border-line px-2 py-1.5 text-sm"
        />
        <select
          value={unit}
          onChange={(e) => onChange(amount ? `${amount} ${e.target.value}` : "")}
          className="rounded border border-line px-1 py-1.5 text-sm"
        >
          <option value="s">s</option>
          <option value="min">min</option>
        </select>
      </span>
    </label>
  );
}

/**
 * Trie les blocs dans l'ordre canonique des groupes (échauffement -> corps de
 * séance -> gainage -> retour au calme) plutôt que dans leur ordre d'ajout.
 * Tri stable : l'ordre à l'intérieur d'un groupe, et donc d'une série, est
 * conservé.
 */
export function sortBlocksByGroupOrder(blocks: BlockRow[]): BlockRow[] {
  const groupIndexOf = (blockType: string) =>
    BLOCK_GROUPS.findIndex((g) => g.types.some((t) => t.value === blockType));
  return [...blocks].sort((a, b) => groupIndexOf(a.block_type) - groupIndexOf(b.block_type));
}
