"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAvailabilityBlockAction } from "@/lib/actions";

export function DeleteAvailabilityButton({ id, className }: { id: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setPending(true);
        await deleteAvailabilityBlockAction(id);
        router.refresh();
        setPending(false);
      }}
      aria-label="Retirer l'indisponibilité"
      className={`${className} disabled:opacity-40`}
    >
      {pending ? "…" : "✕"}
    </button>
  );
}
