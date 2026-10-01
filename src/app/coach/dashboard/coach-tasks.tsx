"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCoachReminderAction,
  updateCoachReminderAction,
  setCoachReminderStatusAction,
  deleteCoachReminderAction,
} from "@/lib/actions";
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

export interface TaskItem extends TargetFields {
  id: string;
  content: string;
  due_date: string | null;
  due_time: string | null;
  started_at: string | null;
  done_at: string | null;
  created_at?: string;
}

type Status = "todo" | "doing" | "done";
const NEXT: Record<Status, Status> = { todo: "doing", doing: "done", done: "todo" };
const STATUS_LABEL: Record<Status, string> = { todo: "à faire", doing: "en cours", done: "faite" };
const HIDE_DONE_KEY = "coach-tasks-hide-done";

function statusOf(t: TaskItem): Status {
  return t.done_at ? "done" : t.started_at ? "doing" : "todo";
}

// Faites en dernier, puis par échéance (sans date à la fin), puis par heure et
// ordre de création.
function sortKey(t: TaskItem) {
  const created = (t.created_at ?? "").replace(" ", "T");
  return `${t.done_at ? 1 : 0}|${t.due_date ?? "9999-99-99"}|${t.due_time ?? "99:99"}|${created}`;
}

// Anneau d'avancement : vide (à faire), à moitié corail (en cours), plein et
// coché (faite). Un clic passe au statut suivant.
function StatusRing({ status, onClick }: { status: Status; onClick: () => void }) {
  const color = status === "done" ? "#1b4b4f" : status === "doing" ? "#e8896a" : "#9aa39c";
  const offset = status === "done" ? 0 : status === "doing" ? 28.27 : 56.55;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Tâche ${STATUS_LABEL[status]} : passer à « ${STATUS_LABEL[NEXT[status]]} »`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
    >
      <svg width="18" height="18" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill="none" stroke="#e3e7e6" strokeWidth="2.6" />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill={status === "done" ? "#1b4b4f" : "transparent"}
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="56.55"
          strokeDashoffset={offset}
          transform="rotate(-90 11 11)"
          style={{ transition: "stroke-dashoffset .4s ease, fill .25s ease .15s, stroke .25s" }}
        />
        <path
          d="M6.8 11.4l2.9 2.9 5.6-6"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: status === "done" ? 1 : 0, transition: "opacity .2s ease .25s" }}
        />
      </svg>
    </button>
  );
}

interface Draft {
  content: string;
  target: string;
  dueDate: string;
  dueTime: string;
}

function TaskForm({
  initial,
  targets,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  targets: TargetOption[];
  submitLabel: string;
  onSubmit: (d: Draft) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState(initial);
  const submit = () => d.content.trim() && onSubmit({ ...d, content: d.content.trim() });
  const label = "flex flex-col gap-1 text-[11px] font-semibold text-slate";
  const field = "rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-moss";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-1.5 flex flex-wrap items-end gap-2 rounded-xl bg-paper p-2.5 animate-expand-in"
    >
      <label className={`${label} basis-full`}>
        Titre
        <input
          autoFocus
          value={d.content}
          onChange={(e) => setD({ ...d, content: e.target.value })}
          onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
          placeholder="Ex. Appeler Hugo pour son test"
          className={field}
        />
      </label>
      <label className={label}>
        Pour
        <TargetSelect value={d.target} onChange={(v) => setD({ ...d, target: v })} options={targets} emptyLabel="Personne en particulier" />
      </label>
      <label className={label}>
        Date
        <input type="date" value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} className={field} />
      </label>
      <label className={label}>
        Heure
        <input
          type="time"
          value={d.dueTime}
          disabled={!d.dueDate}
          onChange={(e) => setD({ ...d, dueTime: e.target.value })}
          className={`${field} disabled:opacity-50`}
        />
      </label>
      <span className="flex-1" />
      {onCancel && (
        <button type="button" onClick={onCancel} className="px-2 py-1.5 text-xs font-semibold text-slate hover:text-ink">
          Annuler
        </button>
      )}
      <button
        type="submit"
        disabled={!d.content.trim()}
        className="rounded-full bg-moss px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-moss-dark disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}

// Tâches du coach : une ligne par tâche (anneau d'avancement, titre, cible,
// date) ; un clic sur la ligne déplie le détail. Jamais visible par les athlètes.
export function CoachTasks({ tasks, targets }: { tasks: TaskItem[]; targets: TargetOption[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const today = todayISO();
  // Copie locale pour un affichage immédiat, resynchronisée quand le serveur
  // renvoie une nouvelle liste (après router.refresh()).
  const [items, setItems] = useState(tasks);
  const [source, setSource] = useState(tasks);
  if (source !== tasks) {
    setSource(tasks);
    setItems(tasks);
  }
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // Choix « masquer les tâches faites » mémorisé dans le navigateur.
  const savedHideDone = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(HIDE_DONE_KEY) === "1";
      } catch {
        return false; // Stockage indisponible (navigation privée).
      }
    },
    () => false
  );
  const [hideDoneChoice, setHideDoneChoice] = useState<boolean | null>(null);
  const hideDone = hideDoneChoice ?? savedHideDone;

  function refresh() {
    start(() => router.refresh());
  }
  function patch(id: string, fields: Partial<TaskItem>) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  function cycle(t: TaskItem) {
    const next = NEXT[statusOf(t)];
    const now = new Date().toISOString();
    patch(t.id, {
      started_at: next === "todo" ? null : t.started_at ?? now,
      done_at: next === "done" ? now : null,
    });
    if (!t.id.startsWith("tmp-")) setCoachReminderStatusAction(t.id, next).then(refresh);
  }

  async function create(d: Draft) {
    const tmp = `tmp-${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        id: tmp,
        content: d.content,
        due_date: d.dueDate || null,
        due_time: d.dueDate ? d.dueTime || null : null,
        started_at: null,
        done_at: null,
        created_at: new Date().toISOString().slice(0, 19),
        ...targetFieldsFrom(d.target, targets),
      },
    ]);
    setAdding(false);
    const fd = new FormData();
    fd.set("content", d.content);
    fd.set("target", d.target);
    if (d.dueDate) fd.set("dueDate", d.dueDate);
    if (d.dueDate && d.dueTime) fd.set("dueTime", d.dueTime);
    const res = await addCoachReminderAction(fd);
    if (res?.id) setItems((prev) => prev.map((t) => (t.id === tmp ? { ...t, id: res.id } : t)));
    refresh();
  }

  function saveEdit(t: TaskItem, d: Draft) {
    patch(t.id, {
      content: d.content,
      due_date: d.dueDate || null,
      due_time: d.dueDate ? d.dueTime || null : null,
      ...targetFieldsFrom(d.target, targets),
    });
    setEditing(null);
    if (!t.id.startsWith("tmp-"))
      updateCoachReminderAction(t.id, { content: d.content, dueDate: d.dueDate || null, dueTime: d.dueDate ? d.dueTime || null : null, target: d.target }).then(refresh);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
    setOpen(null);
    if (!id.startsWith("tmp-")) deleteCoachReminderAction(id).then(refresh);
  }

  function toggleHideDone() {
    const v = !hideDone;
    setHideDoneChoice(v);
    try {
      window.localStorage.setItem(HIDE_DONE_KEY, v ? "1" : "0");
    } catch {
      // Sans persistance, le choix reste valable pour la session en cours.
    }
  }

  const doneCount = items.filter((t) => t.done_at).length;
  const visible = items.filter((t) => !(hideDone && t.done_at)).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const nowTime = new Date().toTimeString().slice(0, 5);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 pb-1.5">
        <h2 className="flex-1 font-display text-[17px] font-semibold text-moss">Tâches</h2>
        {items.length > 0 && (
          <span className="text-sm font-bold text-moss" title="Tâches faites sur le total">
            {doneCount}/{items.length}
          </span>
        )}
        <PlusButton open={adding} onClick={() => setAdding((v) => !v)} label="Nouvelle tâche" />
      </div>

      {adding && (
        <TaskForm
          initial={{ content: "", target: "", dueDate: "", dueTime: "" }}
          targets={targets}
          submitLabel="Ajouter"
          onSubmit={create}
          onCancel={() => setAdding(false)}
        />
      )}

      <ul className="flex flex-col">
        {visible.map((t) => {
          const status = statusOf(t);
          const done = status === "done";
          const late =
            !done && !!t.due_date && (t.due_date < today || (t.due_date === today && !!t.due_time && t.due_time < nowTime));
          const isOpen = open === t.id;
          if (editing === t.id) {
            return (
              <li key={t.id} className="border-t border-paper-dim pt-1.5">
                <TaskForm
                  initial={{ content: t.content, target: targetValue(t), dueDate: t.due_date ?? "", dueTime: t.due_time ?? "" }}
                  targets={targets}
                  submitLabel="Enregistrer"
                  onSubmit={(d) => saveEdit(t, d)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            );
          }
          return (
            <li key={t.id} className="border-t border-paper-dim">
              <div className="flex h-[34px] items-center gap-2 rounded-lg px-0.5 hover:bg-paper/70">
                <StatusRing status={status} onClick={() => cycle(t)} />
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : t.id)}
                  aria-expanded={isOpen}
                  className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-status-notdone line-through" : "text-ink"}`}>{t.content}</span>
                  <TargetTag t={t} className="max-w-[110px]" />
                  <span
                    className={`w-[76px] shrink-0 whitespace-nowrap text-right text-xs ${
                      late ? "font-bold text-[#b4532f]" : t.due_date ? "text-slate" : "text-status-notdone"
                    }`}
                  >
                    {t.due_date ? `${shortDate(t.due_date, today)}${t.due_time ? ` ${t.due_time}` : ""}` : "Sans date"}
                  </span>
                </button>
              </div>
              {isOpen && (
                <div className="mb-2 ml-9 mr-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[10px] bg-paper px-2.5 py-2 text-xs animate-expand-in">
                  <span>
                    <span className="text-slate">Pour </span>
                    <b>{t.first_name ?? t.team_name ?? (t.for_club ? "Club" : "personne en particulier")}</b>
                  </span>
                  <span>
                    <span className="text-slate">Date </span>
                    <b className={late ? "text-[#b4532f]" : ""}>{t.due_date ? shortDate(t.due_date, today, true) : "aucune"}</b>
                  </span>
                  <span>
                    <span className="text-slate">Heure </span>
                    <b>{t.due_time ?? "aucune"}</b>
                  </span>
                  <span className="flex-1" />
                  <button type="button" onClick={() => setEditing(t.id)} className="p-1 font-semibold text-moss-dark hover:underline">
                    Modifier
                  </button>
                  <button type="button" onClick={() => remove(t.id)} className="p-1 font-semibold text-clay hover:underline">
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && !adding && <p className="border-t border-paper-dim py-2 text-sm text-slate">Aucune tâche. Le « + » en ajoute une.</p>}

      {doneCount > 0 && (
        <div className="flex justify-end border-t border-paper-dim">
          <button type="button" onClick={toggleHideDone} className="px-0.5 py-1.5 text-xs font-semibold text-moss-dark hover:underline">
            {hideDone ? `Afficher les tâches faites (${doneCount})` : `Masquer les tâches faites (${doneCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
