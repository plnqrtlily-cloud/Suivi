"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertCheckinAction } from "@/lib/actions";
import { TextAreaField } from "@/components/ui";
import { GradientSlider } from "@/components/gradient-slider";
import { computeGlobalScore, computeHooperIndex, CheckinValues, Checkin } from "@/lib/checkin-types";

const FIELD_NAMES: Record<keyof CheckinValues, string> = {
  physical_level: "physicalLevel",
  mental_level: "mentalLevel",
  sleep_quality: "sleepQuality",
  soreness: "soreness",
  stress: "stress",
};

const ICON_PROPS = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const SLIDERS: {
  key: keyof CheckinValues;
  label: string;
  minLabel: string;
  maxLabel: string;
  family: "green" | "amber";
  icon: React.ReactNode;
}[] = [
  {
    key: "physical_level",
    label: "Forme physique",
    minLabel: "Épuisé·e",
    maxLabel: "En pleine forme",
    family: "green",
    icon: (
      <svg {...ICON_PROPS} stroke="#1B4B4F">
        <rect x="2" y="7" width="16" height="10" rx="2" />
        <path d="M22 11v2" />
      </svg>
    ),
  },
  {
    key: "mental_level",
    label: "Forme mentale / motivation",
    minLabel: "Démotivé·e",
    maxLabel: "Très motivé·e",
    family: "green",
    icon: (
      <svg {...ICON_PROPS} stroke="#1B4B4F">
        <path d="M12 2v3M12 19v3M5 5l2 2M17 17l2 2M2 12h3M19 12h3M5 19l2-2M17 7l2-2" />
      </svg>
    ),
  },
  {
    key: "sleep_quality",
    label: "Qualité du sommeil",
    minLabel: "Très mauvaise nuit",
    maxLabel: "Excellente nuit",
    family: "green",
    icon: (
      <svg {...ICON_PROPS} stroke="#1B4B4F">
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      </svg>
    ),
  },
  {
    key: "soreness",
    label: "Courbatures / douleurs",
    minLabel: "Aucune",
    maxLabel: "Très marquées",
    family: "amber",
    icon: (
      <svg {...ICON_PROPS} stroke="#B85A3E">
        <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" />
      </svg>
    ),
  },
  {
    key: "stress",
    label: "Stress / charge mentale",
    minLabel: "Détendu·e",
    maxLabel: "Très stressé·e",
    family: "green",
    icon: (
      <svg {...ICON_PROPS} stroke="#1B4B4F">
        <path d="M17.5 19a4.5 4.5 0 000-9 6 6 0 00-11.4 2.1A4 4 0 007 19h10.5z" />
      </svg>
    ),
  },
];

export function DailyCheckin({
  date,
  existing,
  onSaved,
  compact = false,
}: {
  date: string;
  existing?: Checkin;
  onSaved?: () => void;
  compact?: boolean;
}) {
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
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"}`}>
        {SLIDERS.map((s) => (
          <GradientSlider
            key={s.key}
            icon={s.icon}
            label={s.label}
            minLabel={s.minLabel}
            maxLabel={s.maxLabel}
            family={s.family}
            value={values[s.key]}
            name={FIELD_NAMES[s.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))}
          />
        ))}
      </div>

      {!compact && (
        <div className="mt-4">
          <TextAreaField label="Remarques (facultatif)" name="notes" rows={2} defaultValue={existing?.notes || ""} placeholder="Contexte particulier, ressenti libre…" />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
        <span className="text-[12.5px] text-slate">Score en direct</span>
        <span className="font-display text-lg font-semibold text-moss-dark">
          {score}
          <span className="font-sans text-xs font-normal text-slate"> / 10</span>
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate">Indice de Hooper : {computeHooperIndex(values)}/50 (plus bas = meilleur état)</p>

      <div className="mt-3">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-moss py-3 text-sm font-semibold text-white transition-colors hover:bg-moss-dark disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : existing ? "Mettre à jour ma forme du jour" : "Enregistrer ma forme du jour"}
        </button>
      </div>
    </form>
  );
}
