"use client";

import { useRouter } from "next/navigation";
import { deleteWorkoutTemplateAction } from "@/lib/actions";
import type { WorkoutTemplateOption } from "./workout-form";

export function TemplateList({ templates }: { templates: WorkoutTemplateOption[] }) {
  const router = useRouter();
  if (templates.length === 0) return null;

  async function handleDelete(id: string) {
    await deleteWorkoutTemplateAction(id);
    router.refresh();
  }

  return (
    <details className="mb-6 text-sm text-slate">
      <summary className="cursor-pointer">Gérer mes modèles ({templates.length})</summary>
      <ul className="mt-2 space-y-1">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-paper-dim px-2 py-1.5">
            <span className="text-ink">{t.name}</span>
            <button type="button" onClick={() => handleDelete(t.id)} aria-label="Supprimer ce modèle" className="hover:text-clay">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
