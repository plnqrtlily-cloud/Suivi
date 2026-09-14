"use client";

import { useState } from "react";
import { Button, SelectField } from "@/components/ui";
import { COMMON_EXERCISES } from "@/lib/exercise-library";
import type { TrainingQuality } from "@/lib/actions";

// Structuration en blocs de la musculation (cf. prompt) :
// échauffement (mobilité / plyométrie / proprioception) -> corps de séance
// (principal / secondaire / complémentaire / spécifique) -> gainage -> retour au calme.
const BLOCK_GROUPS: { title: string; types: { value: string; label: string }[] }[] = [
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
  {
    title: "Gainage",
    types: [{ value: "core", label: "Gainage" }],
  },
  {
    title: "Retour au calme",
    types: [{ value: "cooldown", label: "Retour au calme" }],
  },
];

// Qualité physique travaillée par l'exercice (cf. periodisation classique
// Bompa/NSCA) : chaque qualité se pilote avec des repères de charge/volume/
// repos différents — les champs de saisie ci-dessous s'adaptent en fonction.
const QUALITY_OPTIONS: { value: TrainingQuality; label: string }[] = [
  { value: "force_max", label: "Force maximale" },
  { value: "explosivite", label: "Explosivité / puissance" },
  { value: "force_endurance", label: "Force-endurance" },
  { value: "cardio", label: "Cardio / conditionnement" },
];

const QUALITY_FIELDS: Record<
  TrainingQuality | "default",
  { repsLabel: string; repsPlaceholder: string; loadLabel: string; loadPlaceholder: string; restPlaceholder: string; rpeLabel: string }
> = {
  force_max: {
    repsLabel: "Répétitions",
    repsPlaceholder: "1-5",
    loadLabel: "Charge",
    loadPlaceholder: "90 kg ou 90% 1RM",
    restPlaceholder: "180-300",
    rpeLabel: "RPE / RIR",
  },
  explosivite: {
    repsLabel: "Répétitions",
    repsPlaceholder: "1-6",
    loadLabel: "Charge",
    loadPlaceholder: "30-60% 1RM ou PdC",
    restPlaceholder: "120-240",
    rpeLabel: "Explosivité ressentie (1-10)",
  },
  force_endurance: {
    repsLabel: "Répétitions",
    repsPlaceholder: "15-30+",
    loadLabel: "Charge",
    loadPlaceholder: "40-60% 1RM",
    restPlaceholder: "20-60",
    rpeLabel: "RPE",
  },
  cardio: {
    repsLabel: "Durée (min)",
    repsPlaceholder: "3",
    loadLabel: "Intensité",
    loadPlaceholder: "Z3 / 80% FCmax",
    restPlaceholder: "60",
    rpeLabel: "RPE",
  },
  default: {
    repsLabel: "Répétitions",
    repsPlaceholder: "8-10",
    loadLabel: "Charge",
    loadPlaceholder: "60 kg",
    restPlaceholder: "90",
    rpeLabel: "RPE",
  },
};

export interface SetRow {
  reps: string;
  load: string;
  restSeconds: string;
  rpe: string;
}

export interface BlockRow {
  key: string;
  block_type: string;
  exercise_name: string;
  notes: string;
  resource_id: string;
  training_quality: TrainingQuality | "";
  rep_type: "reps" | "time"; // répétitions comptées ou minutées (façon Garmin/Hevy)
  circuit_id?: string; // exercices partageant le même id = un circuit, enchaînés sans repos
  circuit_rounds?: number;
  sets: SetRow[];
}

export interface LibraryResource {
  id: string;
  title: string;
  type: "video" | "photo" | "equipment";
}

// Un exercice démarre avec une série par défaut, prête à être dupliquée — c'est
// la logique de "copier la série précédente" des meilleures apps de suivi (Strong,
// Hevy) : on ne repart jamais d'un champ vide, on ajuste la valeur précédente.
function defaultSet(): SetRow {
  return { reps: "8-10", load: "", restSeconds: "", rpe: "" };
}

// Convertit une charge prescrite en pourcentage ("80%", "80 %") en kilos à
// partir du dernier max testé pour cet exercice — simple indication affichée
// à côté du champ, la valeur saisie reste du texte libre (un coach peut aussi
// bien écrire "80%" que "60 kg" ou "barre + 2 disques").
function computeLoadFromPercent(load: string, maxKg: number | undefined): string | null {
  if (!maxKg) return null;
  const match = load.trim().match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (!match) return null;
  const pct = parseFloat(match[1].replace(",", "."));
  return `${Math.round(maxKg * (pct / 100) * 2) / 2} kg`;
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
  const attachable = resources.filter((r) => r.type === "video" || r.type === "photo");
  // Les exercices déjà utilisés par ce coach apparaissent en premier dans l'autocomplétion,
  // avant la bibliothèque générique — cf. demande de s'inspirer des meilleures apps.
  const suggestions = [...exerciseHistory, ...COMMON_EXERCISES.filter((e) => !exerciseHistory.includes(e))];

  function update(newRows: BlockRow[]) {
    setRows(newRows);
    onChange(newRows);
  }

  function addRow(defaultType: string) {
    update([
      ...rows,
      {
        key: crypto.randomUUID(),
        block_type: defaultType,
        exercise_name: "",
        notes: "",
        resource_id: "",
        training_quality: "",
        rep_type: "reps",
        sets: [defaultSet()],
      },
    ]);
  }

  // Un circuit = plusieurs exercices enchaînés sans repos entre eux, répétés
  // ensemble N fois (ex. "circuit training" : 4 exercices x 3 tours) — plutôt
  // que le repos classique entre chaque série d'un même exercice.
  function addCircuit(defaultType: string) {
    const circuitId = crypto.randomUUID();
    update([
      ...rows,
      {
        key: crypto.randomUUID(),
        block_type: defaultType,
        exercise_name: "",
        notes: "",
        resource_id: "",
        training_quality: "",
        rep_type: "reps",
        circuit_id: circuitId,
        circuit_rounds: 3,
        sets: [defaultSet()],
      },
      {
        key: crypto.randomUUID(),
        block_type: defaultType,
        exercise_name: "",
        notes: "",
        resource_id: "",
        training_quality: "",
        rep_type: "reps",
        circuit_id: circuitId,
        circuit_rounds: 3,
        sets: [defaultSet()],
      },
    ]);
  }

  function addToCircuit(circuitId: string, defaultType: string, rounds: number) {
    update([
      ...rows,
      {
        key: crypto.randomUUID(),
        block_type: defaultType,
        exercise_name: "",
        notes: "",
        resource_id: "",
        training_quality: "",
        rep_type: "reps",
        circuit_id: circuitId,
        circuit_rounds: rounds,
        sets: [defaultSet()],
      },
    ]);
  }

  function updateCircuitRounds(circuitId: string, rounds: number) {
    update(rows.map((r) => (r.circuit_id === circuitId ? { ...r, circuit_rounds: rounds } : r)));
  }

  function removeFromCircuit(key: string) {
    // Retire l'exercice du circuit sans le supprimer — redevient un exercice normal.
    update(rows.map((r) => (r.key === key ? { ...r, circuit_id: undefined, circuit_rounds: undefined } : r)));
  }

  function updateRow(key: string, patch: Partial<BlockRow>) {
    update(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    update(rows.filter((r) => r.key !== key));
  }

  // Déplace un exercice vers le haut/bas, uniquement parmi les exercices du même
  // groupe (échauffement / corps de séance / gainage / retour au calme) — l'ordre
  // entre groupes reste fixe, seul l'ordre à l'intérieur d'un groupe est modifiable.
  function moveRow(key: string, direction: "up" | "down") {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const groupTypes = BLOCK_GROUPS.find((g) => g.types.some((t) => t.value === row.block_type))?.types.map(
      (t) => t.value
    );
    if (!groupTypes) return;
    const groupIndices = rows.map((r, i) => ({ r, i })).filter((x) => groupTypes.includes(x.r.block_type)).map((x) => x.i);
    const i1 = rows.indexOf(row);
    const posInGroup = groupIndices.indexOf(i1);
    const targetPos = direction === "up" ? posInGroup - 1 : posInGroup + 1;
    if (targetPos < 0 || targetPos >= groupIndices.length) return;
    const i2 = groupIndices[targetPos];
    const newRows = [...rows];
    [newRows[i1], newRows[i2]] = [newRows[i2], newRows[i1]];
    update(newRows);
  }

  function addSet(rowKey: string) {
    update(
      rows.map((r) => {
        if (r.key !== rowKey) return r;
        const last = r.sets[r.sets.length - 1];
        // Copie la dernière série comme point de départ (reps/charge identiques),
        // l'entraîneur n'a qu'à ajuster ce qui change — gain de temps notable à la saisie.
        return { ...r, sets: [...r.sets, last ? { ...last } : defaultSet()] };
      })
    );
  }

  function updateSet(rowKey: string, setIdx: number, patch: Partial<SetRow>) {
    update(
      rows.map((r) => {
        if (r.key !== rowKey) return r;
        const sets = r.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s));
        return { ...r, sets };
      })
    );
  }

  function removeSet(rowKey: string, setIdx: number) {
    update(
      rows.map((r) => (r.key === rowKey ? { ...r, sets: r.sets.filter((_, i) => i !== setIdx) } : r))
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <datalist id="exercise-suggestions">
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {BLOCK_GROUPS.map((group) => {
        const groupRows = rows.filter((r) => group.types.some((t) => t.value === r.block_type));
        return (
          <div key={group.title} className="rounded-3xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate">{group.title}</h3>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => addRow(group.types[0].value)}>
                  + Exercice
                </Button>
                <Button type="button" variant="secondary" onClick={() => addCircuit(group.types[0].value)}>
                  + Circuit
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {(() => {
                // Regroupe les exercices consécutifs partageant le même circuit_id, pour
                // les afficher ensemble dans un encadré "Circuit x N tours" plutôt que
                // comme des exercices isolés.
                const segments: { circuitId: string | null; rows: BlockRow[] }[] = [];
                for (const row of groupRows) {
                  const last = segments[segments.length - 1];
                  if (row.circuit_id && last && last.circuitId === row.circuit_id) {
                    last.rows.push(row);
                  } else {
                    segments.push({ circuitId: row.circuit_id || null, rows: [row] });
                  }
                }

                const renderRow = (row: BlockRow) => {
                  const fields = QUALITY_FIELDS[row.training_quality || "default"];
                  const repsLabel = row.rep_type === "time" ? "Durée" : fields.repsLabel;
                  const repsPlaceholder = row.rep_type === "time" ? "45 sec ou 1 min 30" : fields.repsPlaceholder;
                  return (
                    <div key={row.key} className="rounded-2xl bg-paper-dim p-3">
                      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
                        <div className="sm:col-span-4">
                          <SelectField
                            label="Sous-type"
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
                              {exerciseMaxes?.[row.exercise_name] && (
                                <span className="ml-1.5 font-normal text-slate">— max {exerciseMaxes[row.exercise_name]} kg</span>
                              )}
                            </span>
                            <input
                              list="exercise-suggestions"
                              value={row.exercise_name}
                              onChange={(e) => updateRow(row.key, { exercise_name: e.target.value })}
                              placeholder="Rechercher ou saisir un exercice…"
                              className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                            />
                          </label>
                        </div>
                        <div className="flex items-end gap-1 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => moveRow(row.key, "up")}
                            disabled={groupRows[0]?.key === row.key}
                            className="rounded border border-line px-1.5 py-1.5 text-xs text-ink-soft hover:border-moss disabled:opacity-30"
                            aria-label="Monter cet exercice"
                            title="Monter"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(row.key, "down")}
                            disabled={groupRows[groupRows.length - 1]?.key === row.key}
                            className="rounded border border-line px-1.5 py-1.5 text-xs text-ink-soft hover:border-moss disabled:opacity-30"
                            aria-label="Descendre cet exercice"
                            title="Descendre"
                          >
                            ↓
                          </button>
                          <Button type="button" variant="ghost" onClick={() => removeRow(row.key)}>
                            Retirer
                          </Button>
                        </div>
                      </div>

                      <div className="mb-3">
                        <SelectField
                          label="Qualité travaillée (facultatif)"
                          value={row.training_quality}
                          onChange={(e) => updateRow(row.key, { training_quality: e.target.value as TrainingQuality | "" })}
                        >
                          <option value="">Non précisée</option>
                          {QUALITY_OPTIONS.map((q) => (
                            <option key={q.value} value={q.value}>
                              {q.label}
                            </option>
                          ))}
                        </SelectField>
                      </div>

                      {/* Répétitions comptées ou minutées (ex. gainage "45 sec", corde à
                          sauter "1 min") — façon Garmin Connect / Hevy, qui distinguent les
                          deux plutôt que de tout forcer en répétitions. */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-xs font-medium text-ink-soft">Cet exercice se prescrit en :</span>
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
                        {row.circuit_id && (
                          <button
                            type="button"
                            onClick={() => removeFromCircuit(row.key)}
                            className="ml-auto text-xs text-clay hover:underline"
                          >
                            Sortir du circuit
                          </button>
                        )}
                      </div>

                      {/* Séries détaillées, façon Strong/Hevy : chaque série a ses propres
                          répétitions/charge/repos/RPE (utile pour les séries pyramidales,
                          montées en charge…), avec copie automatique de la dernière série à
                          l'ajout. Les intitulés s'adaptent à la qualité travaillée ci-dessus. */}
                      <div className="mb-3 overflow-hidden rounded-2xl border border-line bg-white">
                        <div className="grid grid-cols-12 gap-1.5 border-b border-line bg-paper-dim px-2 py-1 text-[11px] font-medium text-ink-soft">
                          <span className="col-span-1">#</span>
                          <span className="col-span-3">{repsLabel}</span>
                          <span className="col-span-3">{fields.loadLabel}</span>
                          <span className="col-span-2">Repos (s)</span>
                          <span className="col-span-2">{fields.rpeLabel}</span>
                          <span className="col-span-1"></span>
                        </div>
                        {row.sets.map((s, idx) => (
                          <div key={idx} className="grid grid-cols-12 items-center gap-1.5 border-b border-line px-2 py-1.5 last:border-0">
                            <span className="col-span-1 text-sm text-ink-soft">{idx + 1}</span>
                            <input
                              value={s.reps}
                              onChange={(e) => updateSet(row.key, idx, { reps: e.target.value })}
                              placeholder={repsPlaceholder}
                              className="col-span-3 rounded border border-line px-2 py-1 text-sm"
                            />
                            <div className="col-span-3 flex flex-col gap-0.5">
                              <input
                                value={s.load}
                                onChange={(e) => updateSet(row.key, idx, { load: e.target.value })}
                                placeholder={fields.loadPlaceholder}
                                className="w-full rounded border border-line px-2 py-1 text-sm"
                              />
                              {computeLoadFromPercent(s.load, exerciseMaxes?.[row.exercise_name]) && (
                                <span className="text-[10px] text-moss-dark">
                                  ≈ {computeLoadFromPercent(s.load, exerciseMaxes?.[row.exercise_name])} (max {exerciseMaxes?.[row.exercise_name]} kg)
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={s.restSeconds}
                              onChange={(e) => updateSet(row.key, idx, { restSeconds: e.target.value })}
                              placeholder={fields.restPlaceholder}
                              className="col-span-2 rounded border border-line px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={s.rpe}
                              onChange={(e) => updateSet(row.key, idx, { rpe: e.target.value })}
                              placeholder="1-10"
                              className="col-span-2 rounded border border-line px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeSet(row.key, idx)}
                              className="col-span-1 text-xs text-slate hover:text-clay"
                              aria-label="Retirer la série"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addSet(row.key)}
                          className="w-full border-t border-line px-2 py-1.5 text-left text-xs font-medium text-moss-dark hover:bg-paper-dim"
                        >
                          + Série (copie la précédente)
                        </button>
                      </div>

                      <SelectField
                        label="Vidéo ou photo de la bibliothèque (facultatif)"
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
                      {attachable.length === 0 && (
                        <p className="mt-1 text-xs text-slate">
                          Aucune vidéo/photo dans votre bibliothèque — ajoutez-en depuis « Bibliothèque » dans le menu.
                        </p>
                      )}
                    </div>
                  );
                };

                return segments.map((segment, segIdx) => {
                  if (!segment.circuitId) return <div key={`s${segIdx}`}>{segment.rows.map(renderRow)}</div>;
                  const rounds = segment.rows[0]?.circuit_rounds || 3;
                  return (
                    <div key={segment.circuitId} className="rounded-2xl border-2 border-dashed border-moss/50 p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm font-semibold text-moss-dark">🔁 Circuit</span>
                        <span className="text-xs text-ink-soft">— enchaîné sans repos, répété</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={rounds}
                          onChange={(e) => updateCircuitRounds(segment.circuitId!, Number(e.target.value))}
                          className="w-14 rounded border border-line px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-ink-soft">tours</span>
                      </div>
                      <div className="flex flex-col gap-3">{segment.rows.map(renderRow)}</div>
                      <button
                        type="button"
                        onClick={() => addToCircuit(segment.circuitId!, group.types[0].value, rounds)}
                        className="mt-3 text-xs font-medium text-moss-dark hover:underline"
                      >
                        + Exercice dans ce circuit
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
