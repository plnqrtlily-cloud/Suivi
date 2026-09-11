"use client";

import { useId } from "react";

const FAMILIES = {
  green: { light: "#D6ECE2", dark: "#1E6B4F", thumb: "#143F30", badgeBg: "#E7F1EC" },
  amber: { light: "#F5E9D2", dark: "#B8862E", thumb: "#8A6423", badgeBg: "#F3EAD8" },
};

// Curseur fin avec dégradé de couleur (pâle -> teinte pleine selon la valeur) et
// bulle affichant le chiffre au-dessus de la poignée — direction validée dans les
// maquettes. Un <input type="range"> natif transparent gère le geste réel (glisser,
// clavier, accessibilité) par-dessus le rendu visuel personnalisé.
export function GradientSlider({
  icon,
  label,
  value,
  onChange,
  family = "green",
  minLabel,
  maxLabel,
  name,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
  family?: "green" | "amber";
  minLabel?: string;
  maxLabel?: string;
  name?: string;
}) {
  const id = useId();
  const colors = FAMILIES[family];
  const pct = ((value - 1) / 9) * 100;

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: colors.badgeBg }}
        >
          {icon}
        </span>
        <label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">
          {label}
        </label>
      </div>
      <div className="relative pt-[22px]">
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ left: `${pct}%`, background: colors.thumb }}
        >
          {value}
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${colors.light}, ${colors.dark})` }}
          />
        </div>
        <div
          className="pointer-events-none absolute top-4 h-[18px] w-[18px] -translate-x-1/2 rounded-full bg-white shadow"
          style={{ left: `${pct}%`, border: `2.5px solid ${colors.thumb}` }}
        />
        <input
          id={id}
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          name={name}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 top-2.5 h-[22px] w-full cursor-pointer opacity-0"
        />
      </div>
      {(minLabel || maxLabel) && (
        <div className="mt-1.5 flex justify-between text-[10px] text-slate">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
