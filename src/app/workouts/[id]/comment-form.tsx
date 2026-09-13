"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addWorkoutCommentAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function CommentForm({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (!String(formData.get("body") || "").trim() && !(formData.get("video") as File)?.size) return;
    setPending(true);
    await addWorkoutCommentAction(workoutId, formData);
    setPending(false);
    form.reset();
    setShowVideo(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="body"
          placeholder="Ajouter un commentaire…"
          className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
        />
        <button
          type="button"
          onClick={() => setShowVideo((v) => !v)}
          aria-label="Joindre une vidéo"
          title="Joindre une vidéo (exécution d'un mouvement, correction…)"
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border ${showVideo ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-slate"}`}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="11" height="10" rx="1.5" />
            <path d="M13 8.5l5-2.5v8l-5-2.5" />
          </svg>
        </button>
        <Button type="submit" disabled={pending}>
          Envoyer
        </Button>
      </div>
      {showVideo && (
        <input
          type="file"
          name="video"
          accept="video/mp4,video/webm,video/quicktime"
          className="text-xs text-slate file:mr-2 file:rounded-md file:border file:border-line file:bg-white file:px-2 file:py-1 file:text-xs"
        />
      )}
    </form>
  );
}
