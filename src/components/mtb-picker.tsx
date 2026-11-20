"use client";

import { MTB_DISCIPLINES } from "@/lib/mtb";

// Cyclisme, à préciser : Route, Enduro, DH, Dirt, BMX, Home trainer,
// Électrique. Sans choix, la sortie reste du « cyclisme » simple. `name`
// ajoute un champ caché pour les formulaires.
export function MtbPicker({
  value,
  onChange,
  name,
  label = "Type de cyclisme",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  name?: string;
  label?: string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {MTB_DISCIPLINES.map((d) => {
          const on = value === d.value;
          return (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : d.value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                on ? "border-[#1b4b4f] bg-[#1b4b4f] text-white" : "border-line bg-white text-ink hover:border-[#1b4b4f]"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </div>
  );
}
