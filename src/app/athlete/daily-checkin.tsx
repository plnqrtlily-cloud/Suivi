"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertCheckinAction } from "@/lib/actions";
import { Button, TextAreaField } from "@/components/ui";
import { computeGlobalScore, computeHooperIndex, scoreLabel, scoreColor, CheckinValues, Checkin } from "@/lib/checkin-types";

const SLIDERS: { key: keyof CheckinValues; label: string; hint: string; invert?: boolean }[] = [
  { key: "physical_level", label: "Forme physique", hint: "1 = épuisé·e, 10 = en pleine forme" },
  { key: "mental_level", label: "Forme mentale / motivation", hint: "1 = démotivé·e, 10 = très motivé·e" },
  { key: "sleep_quality", label: "Qualité du sommeil", hint: "1 = très mauvaise nuit, 10 = excellente nuit" },
  { key: "soreness", label: "Courbatures / douleurs", hint: "1 = aucune, 10 = très marquées", invert: true },
  { key: "stress", label: "Stress / charge mentale", hint: "1 = détendu·e, 10 = très stressé·e", invert: true },
];

export function DailyCheckin({ date, existing }: { date: string; existing?: Checkin }) {
  const router = useRouter();
  const [values, setValues] = useState<CheckinValues>({
    physical_level: existing?.physical_level ?? 5,
    mental_level: existing?.mental_level ?? 5,
    sleep_quality: existing?.sleep_quality ?? 5,
    soreness: existing?.soreness ?? 5,
    stress: existing?.stress ?? 5,
  });
  const [pending, setPending] = useState(false);
  const score = computeGlobalScore(values);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("checkDate", date);
    await upsertCheckinAction(formData);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-md bg-paper-dim px-3 py-2">
        <span className="text-sm font-medium text-ink-soft">Forme globale du jour</span>
        <span className={`text-lg font-semibold ${scoreColor(score)}`}>
          {score}/10 · {scoreLabel(score)}
        </span>
      </div>
      <p className="text-xs text-slate">
        Indice de Hooper : {computeHooperIndex(values)}/50 (plus bas = meilleur état) — méthode issue de
        Hooper &amp; Mackinnon (1995), validée pour le suivi de charge d&apos;entraînement.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SLIDERS.map((s) => (
          <label key={s.key} className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between">
              <span className="font-medium text-ink-soft">{s.label}</span>
              <span className="text-ink">{values[s.key]}/10</span>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              name={s.key === "physical_level" ? "physicalLevel" : s.key === "mental_level" ? "mentalLevel" : s.key === "sleep_quality" ? "sleepQuality" : s.key}
              value={values[s.key]}
              onChange={(e) => setValues((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
            />
            <span className="text-xs text-slate">{s.hint}</span>
          </label>
        ))}
      </div>

      <TextAreaField label="Remarques (facultatif)" name="notes" rows={2} defaultValue={existing?.notes || ""} placeholder="Contexte particulier, ressenti libre…" />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : existing ? "Mettre à jour" : "Enregistrer ma forme du jour"}
        </Button>
      </div>
    </form>
  );
}
