"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCoachDashboardNoteAction, updateCoachDashboardNoteAction, deleteCoachDashboardNoteAction } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import {
  PlusButton,
  TargetSelect,
  TargetTag,
  shortDate,
  targetFieldsFrom,
  targetValue,
  type TargetFields,
  type TargetOption,
} from "./dashboard-targets";

export interface NoteItem extends TargetFields {
  id: string;
  content: string;
  created_at: string;
}

function NoteForm({
  initial,
  targets,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { content: string; target: string };
  targets: TargetOption[];
  submitLabel: string;
  onSubmit: (d: { content: string; target: string }) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const submit = () => d.content.trim() && onSubmit({ ...d, content: d.content.trim() });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-1.5 flex flex-col gap-2 rounded-xl bg-paper p-2.5 animate-expand-in"
    >
      <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate">
        Note
        <textarea
          autoFocus
          rows={3}
          value={d.content}
          onChange={(e) => setD({ ...d, content: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Ce que vous voulez garder en tête…"
          className="resize-none rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-moss"
        />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate">
          Pour (facultatif)
          <TargetSelect value={d.target} onChange={(v) => setD({ ...d, target: v })} options={targets} emptyLabel="Personne en particulier" />
        </label>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="px-2 py-1.5 text-xs font-semibold text-slate hover:text-ink">
          Annuler
        </button>
        <button
          type="submit"
          disabled={!d.content.trim()}
          className="rounded-full bg-moss px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-moss-dark disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// Notes libres du coach, à côté des tâches : une ligne par note (première
// ligne du texte, cible, date) ; un clic déplie le texte complet.
export function CoachNotes({ notes, targets }: { notes: NoteItem[]; targets: TargetOption[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const today = todayISO();
  const [items, setItems] = useState(notes);
  const [source, setSource] = useState(notes);
  if (source !== notes) {
    setSource(notes);
    setItems(notes);
  }
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  function refresh() {
    start(() => router.refresh());
  }

  async function create(d: { content: string; target: string }) {
    const tmp = `tmp-${Date.now()}`;
    setItems((prev) => [{ id: tmp, content: d.content, created_at: new Date().toISOString().slice(0, 19).replace("T", " "), ...targetFieldsFrom(d.target, targets) }, ...prev]);
    setAdding(false);
    const fd = new FormData();
    fd.set("content", d.content);
    fd.set("target", d.target);
    const res = await addCoachDashboardNoteAction(fd);
    if (res?.id) setItems((prev) => prev.map((n) => (n.id === tmp ? { ...n, id: res.id } : n)));
    refresh();
  }

  function saveEdit(n: NoteItem, d: { content: string; target: string }) {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, content: d.content, ...targetFieldsFrom(d.target, targets) } : x)));
    setEditing(null);
    if (!n.id.startsWith("tmp-")) updateCoachDashboardNoteAction(n.id, d).then(refresh);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    setOpen(null);
    if (!id.startsWith("tmp-")) deleteCoachDashboardNoteAction(id).then(refresh);
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 pb-1.5">
        <h2 className="flex-1 font-display text-[17px] font-semibold text-moss">Notes</h2>
        {items.length > 0 && <span className="text-sm font-bold text-moss">{items.length}</span>}
        <PlusButton open={adding} onClick={() => setAdding((v) => !v)} label="Nouvelle note" />
      </div>

      {adding && (
        <NoteForm initial={{ content: "", target: "" }} targets={targets} submitLabel="Ajouter" onSubmit={create} onCancel={() => setAdding(false)} />
      )}

      <ul className="flex flex-col">
        {items.map((n) => {
          const isOpen = open === n.id;
          if (editing === n.id) {
            return (
              <li key={n.id} className="border-t border-paper-dim pt-1.5">
                <NoteForm
                  initial={{ content: n.content, target: targetValue(n) }}
                  targets={targets}
                  submitLabel="Enregistrer"
                  onSubmit={(d) => saveEdit(n, d)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            );
          }
          return (
            <li key={n.id} className="border-t border-paper-dim">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : n.id)}
                aria-expanded={isOpen}
                className="flex min-h-[34px] w-full items-center gap-2 rounded-lg px-0.5 text-left hover:bg-paper/70"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9aa39c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M5 3.5h7l3 3v10H5zM12 3.5v3h3M8 10h4.5M8 13h4.5" />
                </svg>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{n.content.split("\n")[0]}</span>
                <TargetTag t={n} className="max-w-[90px]" />
                <span className="w-[58px] shrink-0 text-right text-xs text-status-notdone">{shortDate(n.created_at.slice(0, 10), today)}</span>
              </button>
              {isOpen && (
                <div className="mb-2 ml-6 mr-0.5 flex flex-col gap-1 rounded-[10px] bg-paper px-2.5 py-2 animate-expand-in">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{n.content}</p>
                  <div className="flex justify-end gap-1 text-xs">
                    <button type="button" onClick={() => setEditing(n.id)} className="p-1 font-semibold text-moss-dark hover:underline">
                      Modifier
                    </button>
                    <button type="button" onClick={() => remove(n.id)} className="p-1 font-semibold text-clay hover:underline">
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && !adding && <p className="border-t border-paper-dim py-2 text-sm text-slate">Aucune note. Le « + » en ajoute une.</p>}
    </div>
  );
}
