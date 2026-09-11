"use client";

import { useState } from "react";
import { Button, SelectField } from "@/components/ui";
import { COMMON_EXERCISES } from "@/lib/exercise-library";

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

export interface SetRow {
  reps: string;
  load: string;
}

export interface BlockRow {
  key: string;
  block_type: string;
  exercise_name: string;
  notes: string;
  resource_id: string;
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
  return { reps: "8-10", load: "" };
}

export function StrengthBuilder({
  onChange,
  resources,
  exerciseHistory,
}: {
  onChange: (blocks: BlockRow[]) => void;
  resources: LibraryResource[];
  exerciseHistory: string[];
}) {
  const [rows, setRows] = useState<BlockRow[]>([]);
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
        sets: [defaultSet()],
      },
    ]);
  }

  function updateRow(key: string, patch: Partial<BlockRow>) {
    update(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    update(rows.filter((r) => r.key !== key));
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
          <div key={group.title} className="rounded-md border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink-soft">{group.title}</h3>
              <Button type="button" variant="secondary" onClick={() => addRow(group.types[0].value)}>
                + Exercice
              </Button>
            </div>
            <div className="flex flex-col gap-4">
              {groupRows.map((row) => (
                <div key={row.key} className="rounded-md bg-paper-dim p-3">
                  <div className="mb-3 grid grid-cols-12 gap-2">
                    <div className="col-span-4">
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
                    <div className="col-span-6">
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium text-ink-soft">Exercice</span>
                        <input
                          list="exercise-suggestions"
                          value={row.exercise_name}
                          onChange={(e) => updateRow(row.key, { exercise_name: e.target.value })}
                          placeholder="Rechercher ou saisir un exercice…"
                          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                        />
                      </label>
                    </div>
                    <div className="col-span-2 flex items-end">
                      <Button type="button" variant="ghost" onClick={() => removeRow(row.key)}>
                        Retirer
                      </Button>
                    </div>
                  </div>

                  {/* Séries détaillées, façon Strong/Hevy : chaque série a ses propres
                      répétitions/charge (utile pour les séries pyramidales, montées en
                      charge…), avec copie automatique de la dernière série à l'ajout. */}
                  <div className="mb-3 overflow-hidden rounded-md border border-line bg-white">
                    <div className="grid grid-cols-12 gap-2 border-b border-line bg-paper-dim px-2 py-1 text-xs font-medium text-ink-soft">
                      <span className="col-span-2">Série</span>
                      <span className="col-span-4">Répétitions</span>
                      <span className="col-span-4">Charge</span>
                      <span className="col-span-2"></span>
                    </div>
                    {row.sets.map((s, idx) => (
                      <div key={idx} className="grid grid-cols-12 items-center gap-2 border-b border-line px-2 py-1.5 last:border-0">
                        <span className="col-span-2 text-sm text-ink-soft">{idx + 1}</span>
                        <input
                          value={s.reps}
                          onChange={(e) => updateSet(row.key, idx, { reps: e.target.value })}
                          placeholder="8-10"
                          className="col-span-4 rounded border border-line px-2 py-1 text-sm"
                        />
                        <input
                          value={s.load}
                          onChange={(e) => updateSet(row.key, idx, { load: e.target.value })}
                          placeholder="60 kg"
                          className="col-span-4 rounded border border-line px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeSet(row.key, idx)}
                          className="col-span-2 text-xs text-slate hover:text-clay"
                        >
                          Retirer
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
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
