"use client";

import { useState } from "react";
import { deleteAvailabilityBlockAction } from "@/lib/actions";

export function DeleteAvailabilityButton({ id, className, children }: { id: string; className?: string; /** Texte du bouton (sinon : ✕). */ children?: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Supprimer cette indisponibilité ?")) return;
        setPending(true);
        try {
          await deleteAvailabilityBlockAction(id);
        } finally {
          setPending(false);
        }
      }}
      aria-label={children ? undefined : "Supprimer l'indisponibilité"}
      title="Supprimer"
      className={children ? className : `-m-1.5 p-1.5 disabled:opacity-40 ${className || ""}`}
    >
      {pending ? "…" : (children ?? "✕")}
    </button>
  );
}
