"use client";

import { useState } from "react";
import { Button, SelectField } from "@/components/ui";

// Séance structurée en étapes, façon Garmin Connect : chaque étape a un type
// (échauffement/effort/récupération/repos/retour au calme), une durée (temps,
// distance, ou "manuelle" — l'athlète avance lui-même, ex. bouton lap), et une
// cible facultative (zone FC/allure/puissance déjà calculée à partir des
// données de l'athlète, ou texte libre). Les étapes peuvent être groupées dans
// un bloc "Répéter" (ex. "6x 400m effort / 90s récup") — un seul niveau
// d'imbrication, comme dans l'éditeur simple de Garmin Connect.

export type StepType = "warmup" | "work" | "recovery" | "rest" | "cooldown";
export type DurationType = "time" | "distance" | "manual";
export type TargetType = "none" | "hr_zone" | "pace_zone" | "power_zone" | "free";

const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: "warmup", label: "Échauffement" },
  { value: "work", label: "Effort" },
  { value: "recovery", label: "Récupération" },
  { value: "rest", label: "Repos" },
  { value: "cooldown", label: "Retour au calme" },
];

const DURATION_TYPES: { value: DurationType; label: string }[] = [
  { value: "time", label: "Temps" },
  { value: "distance", label: "Distance" },
  { value: "manual", label: "Manuelle (libre)" },
];

const TARGET_TYPES: { value: TargetType; label: string }[] = [
  { value: "none", label: "Aucune cible" },
  { value: "pace_zone", label: "Zone d'allure" },
  { value: "hr_zone", label: "Zone de FC" },
  { value: "power_zone", label: "Zone de puissance" },
  { value: "free", label: "Cible libre (texte)" },
];

export interface IntervalTarget {
  type: TargetType;
  zone?: number;
  freeText?: string;
}

export interface IntervalStepItem {
  id: string;
  kind: "step";
  stepType: StepType;
  durationType: DurationType;
  durationValue: string; // "10:00" (temps), "1000" (mètres), vide si manuelle
  target: IntervalTarget;
}

export interface RepeatGroupItem {
  id: string;
  kind: "repeat";
  count: number;
  steps: IntervalStepItem[];
}

export type IntervalItem = IntervalStepItem | RepeatGroupItem;

function newStep(stepType: StepType = "work"): IntervalStepItem {
  return {
    id: crypto.randomUUID(),
    kind: "step",
    stepType,
    durationType: "time",
    durationValue: "",
    target: { type: "none" },
  };
}

function TargetPicker({ target, onChange }: { target: IntervalTarget; onChange: (t: IntervalTarget) => void }) {
  return (
    <div className="flex gap-2">
      <select
        value={target.type}
        onChange={(e) => onChange({ type: e.target.value as TargetType })}
        className="rounded border border-line px-2 py-1 text-sm"
      >
        {TARGET_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {(target.type === "hr_zone" || target.type === "pace_zone" || target.type === "power_zone") && (
        <select
          value={target.zone ?? 1}
          onChange={(e) => onChange({ ...target, zone: Number(e.target.value) })}
          className="rounded border border-line px-2 py-1 text-sm"
        >
          {[1, 2, 3, 4, 5].map((z) => (
            <option key={z} value={z}>
              Zone {z}
            </option>
          ))}
        </select>
      )}
      {target.type === "free" && (
        <input
          value={target.freeText || ""}
          onChange={(e) => onChange({ ...target, freeText: e.target.value })}
          placeholder="ex. 4:30/km, 150 bpm…"
          className="w-32 rounded border border-line px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}

function StepRow({
  step,
  onChange,
  onRemove,
}: {
  step: IntervalStepItem;
  onChange: (s: IntervalStepItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper-dim p-2">
      <select
        value={step.stepType}
        onChange={(e) => onChange({ ...step, stepType: e.target.value as StepType })}
        className="rounded border border-line px-2 py-1 text-sm"
      >
        {STEP_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        value={step.durationType}
        onChange={(e) => onChange({ ...step, durationType: e.target.value as DurationType })}
        className="rounded border border-line px-2 py-1 text-sm"
      >
        {DURATION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {step.durationType !== "manual" && (
        <input
          value={step.durationValue}
          onChange={(e) => onChange({ ...step, durationValue: e.target.value })}
          placeholder={step.durationType === "time" ? "10:00" : "1000 m"}
          className="w-24 rounded border border-line px-2 py-1 text-sm"
        />
      )}
      <TargetPicker target={step.target} onChange={(target) => onChange({ ...step, target })} />
      <button type="button" onClick={onRemove} className="ml-auto text-xs text-clay hover:underline">
        Retirer
      </button>
    </div>
  );
}

export function IntervalBuilder({
  items,
  onChange,
}: {
  items: IntervalItem[];
  onChange: (items: IntervalItem[]) => void;
}) {
  function update(newItems: IntervalItem[]) {
    onChange(newItems);
  }

  function addStep() {
    update([...items, newStep()]);
  }

  function addRepeatGroup() {
    update([...items, { id: crypto.randomUUID(), kind: "repeat", count: 4, steps: [newStep()] }]);
  }

  function removeItem(id: string) {
    update(items.filter((i) => i.id !== id));
  }

  function updateItem(id: string, patch: Partial<IntervalItem>) {
    update(items.map((i) => (i.id === id ? ({ ...i, ...patch } as IntervalItem) : i)));
  }

  function moveItem(id: string, direction: "up" | "down") {
    const idx = items.findIndex((i) => i.id === id);
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    update(newItems);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate">
        Construisez la séance étape par étape (échauffement, efforts, récupérations…), avec des cibles basées sur
        les zones de l&apos;athlète — comme un entraînement structuré Garmin Connect.
      </p>

      {items.map((item, idx) => (
        <div key={item.id} className="flex items-start gap-2">
          <div className="flex flex-col gap-1 pt-2">
            <button
              type="button"
              onClick={() => moveItem(item.id, "up")}
              disabled={idx === 0}
              className="rounded border border-line px-1 text-xs text-ink-soft hover:border-moss disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveItem(item.id, "down")}
              disabled={idx === items.length - 1}
              className="rounded border border-line px-1 text-xs text-ink-soft hover:border-moss disabled:opacity-30"
            >
              ↓
            </button>
          </div>

          {item.kind === "step" ? (
            <div className="flex-1">
              <StepRow step={item} onChange={(s) => updateItem(item.id, s)} onRemove={() => removeItem(item.id)} />
            </div>
          ) : (
            <div className="flex-1 rounded-2xl border-2 border-dashed border-moss/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-ink">Répéter</span>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={item.count}
                  onChange={(e) => updateItem(item.id, { count: Number(e.target.value) } as Partial<RepeatGroupItem>)}
                  className="w-16 rounded border border-line px-2 py-1 text-sm"
                />
                <span className="text-sm text-ink-soft">fois</span>
                <button type="button" onClick={() => removeItem(item.id)} className="ml-auto text-xs text-clay hover:underline">
                  Retirer le groupe
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {item.steps.map((s) => (
                  <StepRow
                    key={s.id}
                    step={s}
                    onChange={(newStep) =>
                      updateItem(item.id, { steps: item.steps.map((x) => (x.id === s.id ? newStep : x)) } as Partial<RepeatGroupItem>)
                    }
                    onRemove={() =>
                      updateItem(item.id, { steps: item.steps.filter((x) => x.id !== s.id) } as Partial<RepeatGroupItem>)
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateItem(item.id, { steps: [...item.steps, newStep("work")] } as Partial<RepeatGroupItem>)
                  }
                  className="self-start text-xs font-medium text-moss-dark hover:underline"
                >
                  + Étape dans la répétition
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={addStep}>
          + Étape
        </Button>
        <Button type="button" variant="secondary" onClick={addRepeatGroup}>
          + Groupe répété
        </Button>
      </div>
    </div>
  );
}
