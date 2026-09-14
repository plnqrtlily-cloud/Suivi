"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateJournalEntryAction, deleteJournalEntryAction } from "@/lib/actions";
import { Button, Field, TextAreaField } from "@/components/ui";

export interface JournalEntryItem {
  id: string;
  entry_date: string;
  content: string;
}

export function JournalEntry({ entry }: { entry: JournalEntryItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("entryId", entry.id);
    await updateJournalEntryAction(formData);
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette entrée du journal ?")) return;
    setPending(true);
    await deleteJournalEntryAction(entry.id);
    setPending(false);
    router.refresh();
  }

  if (editing) {
    return (
      <li className="rounded-xl bg-paper-dim p-3">
        <form onSubmit={handleSave} className="flex flex-col gap-2">
          <Field label="Date" type="date" name="entryDate" defaultValue={entry.entry_date} required />
          <TextAreaField label="Note" name="content" rows={3} defaultValue={entry.content} required />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl bg-paper-dim p-2 text-sm">
      <div>
        <span className="text-slate">{entry.entry_date} — </span>
        <span className="text-ink">{entry.content}</span>
      </div>
      <div className="flex shrink-0 gap-2 text-xs">
        <button type="button" onClick={() => setEditing(true)} className="text-moss-dark hover:underline" disabled={pending}>
          Modifier
        </button>
        <button type="button" onClick={handleDelete} className="text-clay hover:underline" disabled={pending}>
          Supprimer
        </button>
      </div>
    </li>
  );
}
