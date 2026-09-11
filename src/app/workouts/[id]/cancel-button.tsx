"use client";

import { cancelWorkoutAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function CancelWorkoutButton({ workoutId }: { workoutId: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="text-clay"
      onClick={async () => {
        if (!confirm("Annuler cette séance ? L'athlète sera notifié.")) return;
        await cancelWorkoutAction(workoutId);
      }}
    >
      Annuler cette séance
    </Button>
  );
}
