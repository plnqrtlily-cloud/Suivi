"use client";

import { useState, useEffect } from "react";

// Saisie de durée façon Garmin/Strava : minutes + secondes séparément plutôt
// qu'un champ texte libre à interpréter — évite les ambiguïtés ("1:30" =
// 1min30 ou 1h30 ?) et les erreurs de saisie. Expose toujours la durée totale
// en secondes (via un champ caché "name"), pour rester un simple nombre côté
// serveur quel que soit l'écran qui l'utilise.
export function DurationInput({
  name,
  defaultSeconds,
  required,
}: {
  name: string;
  defaultSeconds?: number;
  required?: boolean;
}) {
  const [minutes, setMinutes] = useState(defaultSeconds ? Math.floor(defaultSeconds / 60) : 0);
  const [seconds, setSeconds] = useState(defaultSeconds ? defaultSeconds % 60 : 0);
  const total = minutes * 60 + seconds;

  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-soft">Minutes</span>
        <input
          type="number"
          min={0}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
          className="w-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
        />
      </label>
      <span className="pb-2.5 text-slate">:</span>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-soft">Secondes</span>
        <input
          type="number"
          min={0}
          max={59}
          value={seconds}
          onChange={(e) => setSeconds(Math.min(59, Math.max(0, Number(e.target.value))))}
          className="w-20 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
        />
      </label>
      <input type="hidden" name={name} value={total} required={required} />
      {total > 0 && <span className="pb-2.5 text-xs text-slate">= {total} sec</span>}
    </div>
  );
}

// Formatte des secondes en "1 min 30" / "45 sec" pour l'affichage en lecture seule.
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s} sec`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}`;
}
