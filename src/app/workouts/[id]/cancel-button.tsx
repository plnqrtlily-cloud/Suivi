"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelWorkoutAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function CancelWorkoutButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      className="text-clay"
      loading={pending}
      onClick={async () => {
        if (!confirm("Annuler cette séance ? L'athlète sera notifié.")) return;
        setPending(true);
        await cancelWorkoutAction(workoutId);
        router.refresh();
        setPending(false);
      }}
    >
      Annuler cette séance
    </Button>
  );
}
