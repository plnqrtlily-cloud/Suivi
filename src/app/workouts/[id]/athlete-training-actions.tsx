"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AthleteTrainingForm, type AthleteTrainingExisting } from "@/components/athlete-training-form";
import { planningDeleteWorkoutAction } from "@/lib/actions";

// Actions de l'athlète sur un entraînement qu'il a ajouté lui-même.
export function EditAthleteTrainingButton({ existing, className }: { existing: AthleteTrainingExisting; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Modifier la séance
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-label="Modifier l'entraînement"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] bg-white px-5 pt-5 shadow-2xl sm:max-w-md sm:rounded-[26px]"
              style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
            >
              <h2 className="mb-4 text-xl font-bold text-ink">Modifier l&apos;entraînement</h2>
              <AthleteTrainingForm existing={existing} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function DeleteAthleteTrainingButton({ id, title, className }: { id: string; title: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={async () => {
        if (!confirm(`Supprimer « ${title} » ?`)) return;
        setPending(true);
        try {
          await planningDeleteWorkoutAction(id);
          router.push("/athlete/programmation");
        } catch (err) {
          setPending(false);
          alert(err instanceof Error ? err.message : "Une erreur est survenue.");
        }
      }}
    >
      Supprimer
    </button>
  );
}
