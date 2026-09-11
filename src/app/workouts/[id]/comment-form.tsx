"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addWorkoutCommentAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function CommentForm({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!value.trim()) return;
    setPending(true);
    await addWorkoutCommentAction(workoutId, value);
    setValue("");
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ajouter un commentaire…"
        className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
      />
      <Button type="submit" disabled={pending}>
        Envoyer
      </Button>
    </form>
  );
}
