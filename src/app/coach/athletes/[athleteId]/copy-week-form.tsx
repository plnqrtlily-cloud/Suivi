"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyWeekAction } from "@/lib/actions";
import { Button, Field } from "@/components/ui";

// Copier tout un microcycle qui a bien fonctionné vers une autre semaine, plutôt
// que de recréer chaque séance une par une (cf. demande coach : "publier plus
// facilement").
export function CopyWeekForm({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await copyWeekAction({
        athleteId,
        sourceWeekStart: String(formData.get("sourceWeekStart")),
        targetWeekStart: String(formData.get("targetWeekStart")),
      });
      setResult(res.count);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Copier une semaine
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-3">
      <p className="text-xs text-slate">Indiquez le lundi de chaque semaine (les 7 jours suivants seront copiés).</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Semaine à copier (lundi)" type="date" name="sourceWeekStart" required />
        <Field label="Semaine cible (lundi)" type="date" name="targetWeekStart" required />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Copie…" : "Copier"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Annuler
        </Button>
        {result !== null && <span className="text-sm text-ink">{result} séance(s) copiée(s).</span>}
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
