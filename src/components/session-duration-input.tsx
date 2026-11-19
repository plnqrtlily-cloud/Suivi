"use client";

import { useState } from "react";
import { formatDuration, parseDuration } from "@/lib/duration";

// Champ de durée écrit librement (cf. src/lib/duration.ts) : « 45 », « 45 min »,
// « 1h30 », « 1:30 »… avec, sous le champ, la durée comprise. Le formulaire
// reçoit des minutes : champ caché `name`, et/ou `onChange` (minutes en texte,
// "" si vide ou illisible).
export function SessionDurationInput({
  name,
  label,
  defaultMinutes,
  value,
  onChange,
  required,
  placeholder = "45 min ou 1h30",
  className,
  labelClassName = "flex flex-col gap-1.5 text-sm",
  labelTextClassName = "text-ink-soft font-medium",
  bare,
}: {
  name?: string;
  label?: string;
  defaultMinutes?: number | string | null;
  /** Mode contrôlé : minutes en texte (ex. « 90 »). */
  value?: string;
  onChange?: (minutes: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  labelTextClassName?: string;
  /** Sans libellé ni aide (intégré dans une ligne). */
  bare?: boolean;
}) {
  const initial = value ?? (defaultMinutes != null && defaultMinutes !== "" ? String(defaultMinutes) : "");
  const [text, setText] = useState(() => (initial ? formatDuration(Number(initial)) : ""));
  const minutes = parseDuration(text);
  // Mode contrôlé : la valeur peut changer de l'extérieur (bouton « modèle »…).
  const [seen, setSeen] = useState(value);
  if (value !== undefined && value !== seen) {
    setSeen(value);
    if (value !== (minutes == null ? "" : String(minutes))) setText(value ? formatDuration(Number(value)) : "");
  }
  const invalid = text.trim() !== "" && minutes == null;

  const input = (
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      value={text}
      required={required}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setText(e.target.value);
        const m = parseDuration(e.target.value);
        onChange?.(m == null ? "" : String(m));
      }}
      onBlur={() => minutes != null && setText(formatDuration(minutes))}
      className={
        className ??
        `rounded-md border bg-white px-3 py-2 text-ink outline-none focus:ring-1 ${invalid ? "border-[#a4492a] focus:ring-[#a4492a]" : "border-line focus:border-moss focus:ring-moss"}`
      }
    />
  );
  const hidden = name ? <input type="hidden" name={name} value={minutes ?? ""} /> : null;

  if (bare)
    return (
      <>
        {input}
        {hidden}
      </>
    );
  return (
    <label className={labelClassName}>
      {label && <span className={labelTextClassName}>{label}</span>}
      {input}
      {hidden}
      <span className={`-mt-0.5 text-[11.5px] font-normal ${invalid ? "text-[#a4492a]" : "text-slate"}`}>
        {invalid ? "Écrire par ex. 45 min, 1h ou 1h30" : minutes != null ? `= ${formatDuration(minutes)}` : "en minutes (45) ou en heures (1h30)"}
      </span>
    </label>
  );
}
