"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWorkoutStatusAction } from "@/lib/actions";
import { Button, TextAreaField } from "@/components/ui";

const STATUSES: { value: "done" | "not_done" | "partial" | "postponed"; label: string }[] = [
  { value: "done", label: "Faite" },
  { value: "partial", label: "Partielle" },
  { value: "not_done", label: "Non réalisée" },
  { value: "postponed", label: "Reportée" },
];

export function StatusForm({ workoutId, currentStatus }: { workoutId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus === "planned" ? "done" : currentStatus);
  const [rpe, setRpe] = useState(5);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    await updateWorkoutStatusAction({
      workoutId,
      status: status as any,
      rpe,
      athleteFeedback: String(formData.get("feedback") || ""),
      actualDurationMinutes: formData.get("actualDuration") ? Number(formData.get("actualDuration")) : undefined,
    });
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              status === s.value ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-ink-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-soft">Ressenti (RPE) — {rpe}/10</span>
        <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} />
      </label>

      <input
        type="number"
        name="actualDuration"
        placeholder="Durée réelle (minutes, facultatif)"
        className="rounded-md border border-line bg-white px-3 py-2 text-sm"
      />

      <TextAreaField label="Sensations, remarques" name="feedback" rows={3} placeholder="Comment s'est passée la séance ?" />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
