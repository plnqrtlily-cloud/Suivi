"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addJournalEntryAction } from "@/lib/actions";
import { TextAreaField, Button } from "@/components/ui";

// Un <form action={addJournalEntryAction}> nu ne se vide pas après l'ajout —
// Next.js ne réinitialise pas les champs non contrôlés d'un formulaire lié
// directement à une Server Action. Sans ce composant, le texte saisi restait
// affiché après l'ajout, comme si la note n'avait pas été prise en compte.
export function AddJournalEntryForm({ selectedDate }: { selectedDate: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    await addJournalEntryAction(formData);
    setPending(false);
    setFormKey((k) => k + 1);
    router.refresh();
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="entryDate" value={selectedDate} />
      <TextAreaField label="Note" name="content" rows={3} required placeholder="Sensations du jour, fatigue, contexte particulier…" />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Ajout…" : "Ajouter une note à ce jour"}
        </Button>
      </div>
    </form>
  );
}
