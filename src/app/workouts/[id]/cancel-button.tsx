"use client";

import { useState } from "react";
import { cancelWorkoutAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function CancelWorkoutButton({ workoutId, className }: { workoutId: string; className?: string }) {
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (!confirm("Supprimer cette séance ? L'athlète sera prévenu.")) return;
    setPending(true);
    await cancelWorkoutAction(workoutId);
    setPending(false);
  };
  if (className)
    return (
      <button type="button" disabled={pending} onClick={run} className={className}>
        Supprimer
      </button>
    );
  return (
    <Button
      type="button"
      variant="ghost"
      className="text-clay"
      loading={pending}
      onClick={async () => {
        if (!confirm("Supprimer cette séance ? L'athlète sera prévenu.")) return;
        setPending(true);
        await cancelWorkoutAction(workoutId);
        setPending(false);
      }}
    >
      Annuler cette séance
    </Button>
  );
}
