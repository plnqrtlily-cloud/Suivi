"use client";

import { useState } from "react";
import { importExerciseAnimationsAction } from "@/lib/actions";
import { Button, ErrorText } from "@/components/ui";

// Proposé tant qu'il reste des animations livrées avec l'application qui ne sont
// pas encore dans la bibliothèque du coach (cf. src/lib/exercise-animations.ts).
export function ImportAnimationsCard({ missing, outdated = 0, total }: { missing: number; outdated?: number; total: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleImport() {
    setPending(true);
    setError(undefined);
    const result = await importExerciseAnimationsAction();
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="mb-8 flex flex-col gap-3 rounded-3xl border border-moss/30 bg-moss/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-ink">Animations d&apos;exercices prêtes à l&apos;emploi</p>
        <p className="text-sm text-slate">
          {missing === total
            ? `${total} petites animations (squat, soulevé de terre, gainage, plio…) à joindre aux exercices de vos séances.`
            : [
                missing ? `${missing} animation(s) sur ${total} ne sont pas encore dans votre bibliothèque.` : null,
                outdated ? `${outdated} animation(s) ont été refaites depuis votre import : mettez-les à jour.` : null,
              ]
                .filter(Boolean)
                .join(" ")}
        </p>
        <ErrorText>{error}</ErrorText>
      </div>
      <Button onClick={handleImport} disabled={pending} className="shrink-0">
        {pending ? "Import en cours…" : missing ? `Ajouter ${missing > 1 ? `les ${missing} animations` : "l'animation manquante"}${outdated ? " et mettre à jour" : ""}` : "Mettre à jour"}
      </Button>
    </div>
  );
}
