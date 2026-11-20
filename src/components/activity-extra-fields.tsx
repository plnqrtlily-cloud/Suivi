"use client";

import { SessionDurationInput } from "@/components/session-duration-input";
import { Field } from "@/components/ui";

// Champs complémentaires d'une activité d'extérieur : temps total (pauses
// comprises, quand l'appli de l'athlète le donne) et lien du parcours.

export function ElapsedTimeField({ defaultMinutes, className }: { defaultMinutes?: number | null; className?: string }) {
  return (
    <SessionDurationInput
      label="Temps total (facultatif)"
      name="elapsedMinutes"
      defaultMinutes={defaultMinutes ?? null}
      placeholder="pauses comprises, ex. 2h15"
      className={className}
    />
  );
}

export function RouteUrlField({ defaultValue, label = "Lien du parcours (facultatif)" }: { defaultValue?: string | null; label?: string }) {
  return <Field label={label} type="text" inputMode="url" autoComplete="off" name="routeUrl" maxLength={600} defaultValue={defaultValue ?? ""} placeholder="Strava, Komoot, Trailforks…" />;
}
