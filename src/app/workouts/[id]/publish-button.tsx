"use client";

import { useState } from "react";
import { publishWorkoutAction } from "@/lib/actions";

// Publie une séance restée en brouillon : elle devient visible par l'athlète,
// qui reçoit alors seulement la notification.
export function PublishWorkoutButton({ workoutId }: { workoutId: string }) {
  const [pending, setPending] = useState(false);

  async function handlePublish() {
    setPending(true);
    await publishWorkoutAction(workoutId);
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={handlePublish}
      disabled={pending}
      className="rounded-full bg-moss px-3 py-1 text-sm font-semibold text-white hover:bg-moss-dark disabled:opacity-60"
    >
      {pending ? "Publication…" : "Publier"}
    </button>
  );
}
