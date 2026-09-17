"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addCoachReminderAction, toggleCoachReminderAction, deleteCoachReminderAction } from "@/lib/actions";
import { Button } from "@/components/ui";
import { todayISO } from "@/lib/dates";

export interface ReminderItem {
  id: string;
  content: string;
  due_date: string | null;
  done_at: string | null;
  athlete_id: string | null;
  first_name?: string | null;
}

// Pense-bête du coach : « refaire tester le FTP de Léa », « appeler Tom avant
// sa course ». Jamais visible par les athlètes.
export function CoachReminders({
  reminders,
  athletes,
}: {
  reminders: ReminderItem[];
  athletes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [showDone, setShowDone] = useState(false);
  // Copie locale : router.refresh() ne ramène pas toujours les données
  // fraîches avant le prochain rendu, ce qui faisait disparaître un rappel
  // à peine ajouté jusqu'au rechargement manuel de la page.
  const [items, setItems] = useState(reminders);
  useEffect(() => setItems(reminders), [reminders]);

  const pendingReminders = items.filter((r) => !r.done_at);
  const doneReminders = items.filter((r) => r.done_at);
  const today = todayISO();

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    const fd = new FormData(form);
    await addCoachReminderAction(fd);
    const athleteId = String(fd.get("athleteId") || "") || null;
    setItems((prev) => [
      {
        id: `tmp-${Date.now()}`,
        content: String(fd.get("content") || ""),
        due_date: String(fd.get("dueDate") || "") || null,
        done_at: null,
        athlete_id: athleteId,
        first_name: athletes.find((a) => a.id === athleteId)?.name.split(" ")[0] ?? null,
      },
      ...prev,
    ]);
    setPending(false);
    form.reset();
    setOpen(false);
    router.refresh();
  }

  async function handleToggle(id: string) {
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done_at: r.done_at ? null : new Date().toISOString() } : r))
    );
    await toggleCoachReminderAction(id);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    await deleteCoachReminderAction(id);
    router.refresh();
  }

  function ReminderRow({ r }: { r: ReminderItem }) {
    const isLate = !r.done_at && r.due_date && r.due_date < today;
    return (
      <li className="flex items-start gap-2 text-sm">
        <button
          type="button"
          onClick={() => handleToggle(r.id)}
          aria-label={r.done_at ? "Marquer à faire" : "Marquer comme fait"}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
            r.done_at ? "border-moss bg-moss text-white" : "border-line hover:border-moss"
          }`}
        >
          {r.done_at ? "✓" : ""}
        </button>
        <span className="min-w-0 flex-1">
          <span className={r.done_at ? "text-slate line-through" : "text-ink"}>{r.content}</span>
          {(r.first_name || r.due_date) && (
            <span className={`ml-1.5 text-xs ${isLate ? "font-medium text-gold-light" : "text-slate"}`}>
              {r.first_name && `· ${r.first_name}`}
              {r.due_date && ` · ${isLate ? "en retard depuis le " : ""}${r.due_date}`}
            </span>
          )}
        </span>
        <button type="button" onClick={() => handleDelete(r.id)} aria-label="Supprimer" className="shrink-0 text-xs text-slate hover:text-clay">
          ✕
        </button>
      </li>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate">
          Mes rappels
          {pendingReminders.length > 0 && <span className="ml-1.5 font-normal normal-case">({pendingReminders.length})</span>}
        </h2>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-moss-dark hover:underline">
            + Ajouter
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleAdd} className="mb-3 flex flex-col gap-2 rounded-2xl bg-paper-dim p-3">
          <input
            name="content"
            required
            autoFocus
            placeholder="ex. Refaire tester le FTP de Léa"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
          />
          <div className="flex flex-wrap gap-2">
            <select name="athleteId" className="rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-moss">
              <option value="">Aucun athlète</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="dueDate"
              className="rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-moss"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Ajout…" : "Ajouter"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {pendingReminders.length === 0 && !open && <p className="text-sm text-slate">Rien à faire pour l&apos;instant.</p>}

      <ul className="flex flex-col gap-2">
        {pendingReminders.map((r) => (
          <ReminderRow key={r.id} r={r} />
        ))}
      </ul>

      {doneReminders.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="mt-3 text-xs text-slate hover:underline"
          >
            {showDone ? "Masquer" : "Voir"} les {doneReminders.length} rappel{doneReminders.length > 1 ? "s" : ""} terminé
            {doneReminders.length > 1 ? "s" : ""}
          </button>
          {showDone && (
            <ul className="mt-2 flex flex-col gap-2">
              {doneReminders.map((r) => (
                <ReminderRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
