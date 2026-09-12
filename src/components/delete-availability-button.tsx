"use client";

import { useRouter } from "next/navigation";
import { deleteAvailabilityBlockAction } from "@/lib/actions";

export function DeleteAvailabilityButton({ id, className }: { id: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteAvailabilityBlockAction(id);
        router.refresh();
      }}
      aria-label="Retirer l'indisponibilité"
      className={className}
    >
      ✕
    </button>
  );
}
