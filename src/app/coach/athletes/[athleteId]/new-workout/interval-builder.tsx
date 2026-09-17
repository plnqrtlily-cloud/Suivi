"use client";

import { useState } from "react";
import { Button, SelectField } from "@/components/ui";
import { sportConfig, templateStructure } from "@/lib/sport-config";

// Séance structurée en blocs, façon Garmin Connect : chaque bloc a un type
// (échauffement/effort/récupération/repos/retour au calme), une durée (temps,
// distance, ou "manuelle" — l'athlète avance lui-même, ex. bouton lap), et une
// cible facultative (zone FC/allure/puissance déjà calculée à partir des
// données de l'athlète, ou texte libre). Les blocs peuvent être groupés dans
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

function TargetPicker({ target, onChange, sport }: { target: IntervalTarget; onChange: (t: IntervalTarget) => void; sport: string }) {
  // N'afficher que les cibles qui ont du sens pour ce sport : pas de zone de
  // puissance en natation, pas de zone d'allure en escalade.
  const allowed = sportConfig(sport).targets as string[];
  const options = TARGET_TYPES.filter((t) => t.value === "none" || allowed.includes(t.value));
  return (
    <div className="flex gap-2">
      <select
        value={target.type}
        onChange={(e) => onChange({ type: e.target.value as TargetType })}
        className="rounded border border-line px-2 py-1 text-sm"
      >
        {options.map((t) => (
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

// Durée saisie en nombre + unité (minutes ou secondes) plutôt qu'au format
// "mm:ss" à taper à la main : une récupération de 45 secondes s'écrit « 45 s »,
// une sortie de 90 minutes « 90 min », sans conversion mentale. La valeur reste
// stockée en mm:ss pour ne rien changer à ce qui existe déjà.
function parseStoredTime(value: string): { amount: string; unit: "min" | "sec" } {
  const match = value.trim().match(/^(\d+):(\d{1,2})$/);
  if (!match) return { amount: value.replace(/\D/g, ""), unit: "min" };
  const min = Number(match[1]);
  const sec = Number(match[2]);
  // Moins d'une minute : plus lisible en secondes.
  if (min === 0) return { amount: String(sec), unit: "sec" };
  // Minutes entières : on reste en minutes ; sinon on bascule en secondes pour
  // ne pas perdre l'appoint (ex. 1:30 -> 90 s).
  if (sec === 0) return { amount: String(min), unit: "min" };
  return { amount: String(min * 60 + sec), unit: "sec" };
}

function toStoredTime(amount: string, unit: "min" | "sec"): string {
  const n = Number(amount);
  if (!amount || Number.isNaN(n)) return "";
  const totalSeconds = unit === "min" ? n * 60 : n;
  const mm = Math.floor(totalSeconds / 60);
  const ss = Math.round(totalSeconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function TimeValueInput({
  step,
  onChange,
}: {
  step: IntervalStepItem;
  onChange: (s: IntervalStepItem) => void;
}) {
  const { amount, unit } = parseStoredTime(step.durationValue);
  return (
    <>
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => onChange({ ...step, durationValue: toStoredTime(e.target.value, unit) })}
        placeholder="10"
        className="w-20 rounded border border-line px-2 py-1 text-sm"
      />
      <select
        value={unit}
        onChange={(e) => onChange({ ...step, durationValue: toStoredTime(amount, e.target.value as "min" | "sec") })}
        className="rounded border border-line px-2 py-1 text-sm"
      >
        <option value="min">min</option>
        <option value="sec">sec</option>
      </select>
    </>
  );
}

function StepRow({
  step,
  onChange,
  onRemove,
  sport,
}: {
  step: IntervalStepItem;
  onChange: (s: IntervalStepItem) => void;
  onRemove: () => void;
  sport: string;
}) {
  const cfg = sportConfig(sport);
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
        {DURATION_TYPES.filter((t) => cfg.durations.includes(t.value)).map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {step.durationType === "time" && <TimeValueInput step={step} onChange={onChange} />}
      {step.durationType === "distance" && (
        <input
          type="number"
          min={0}
          value={step.durationValue}
          onChange={(e) => onChange({ ...step, durationValue: e.target.value })}
          placeholder={cfg.distanceUnit === "m" ? "100" : "1000"}
          className="w-24 rounded border border-line px-2 py-1 text-sm"
        />
      )}
      {step.durationType === "distance" && <span className="text-xs text-slate">m</span>}
      <TargetPicker target={step.target} onChange={(target) => onChange({ ...step, target })} sport={sport} />
      <button type="button" onClick={onRemove} className="ml-auto text-xs text-clay hover:underline">
        Retirer
      </button>
    </div>
  );
}

export function IntervalBuilder({
  items,
  onChange,
  sport,
}: {
  items: IntervalItem[];
  onChange: (items: IntervalItem[]) => void;
  sport: string;
}) {
  const cfg = sportConfig(sport);
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
        Construisez la séance bloc par bloc (échauffement, efforts, récupérations…), avec des cibles basées sur
        les zones de l&apos;athlète — comme un entraînement structuré Garmin Connect ou TrainingPeaks.
      </p>

      {/* Modèles de structure : partir d'une base cohérente plutôt que d'une
          page vide, comme les "block templates" de TrainingPeaks. Adaptés au
          sport choisi (une série de natation se compte en mètres, une sortie
          vélo en minutes). */}
      {items.length === 0 && (
        <div className="rounded-2xl bg-paper-dim p-3">
          <p className="mb-2 text-xs font-medium text-ink-soft">Partir d&apos;un modèle :</p>
          <div className="flex flex-wrap gap-2">
            {cfg.templates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => update(templateStructure(sport, t.label) as IntervalItem[])}
                title={t.description}
                className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink-soft hover:border-moss hover:text-moss-dark"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <StepRow step={item} onChange={(s) => updateItem(item.id, s)} onRemove={() => removeItem(item.id)} sport={sport} />
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
                    sport={sport}
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateItem(item.id, { steps: [...item.steps, newStep("work")] } as Partial<RepeatGroupItem>)
                  }
                  className="self-start text-xs font-medium text-moss-dark hover:underline"
                >
                  + Bloc dans la répétition
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={addStep}>
          + Bloc
        </Button>
        <Button type="button" variant="secondary" onClick={addRepeatGroup}>
          + Groupe répété
        </Button>
      </div>
    </div>
  );
}
