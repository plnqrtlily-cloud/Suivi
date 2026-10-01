"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCoachReminderAction,
  updateCoachReminderAction,
  setCoachReminderStatusAction,
  deleteCoachReminderAction,
  addCoachDeskNoteAction,
  updateCoachDeskNoteAction,
  deleteCoachDeskNoteAction,
} from "@/lib/actions";

export interface DeskTask {
  id: string;
  content: string;
  due_date: string | null;
  due_time: string | null;
  done_at: string | null;
  in_progress: number;
  athlete_id: string | null;
  team_id: string | null;
  for_club: number;
  first_name: string | null;
  team_name: string | null;
  created_at: string;
}

export interface DeskNote {
  id: string;
  body: string;
  athlete_id: string | null;
  team_id: string | null;
  for_club: number;
  first_name: string | null;
  team_name: string | null;
  created_at: string;
}

type Target = { value: string; label: string };

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const RING = ["#9aa39c", "#e8896a", "#1b4b4f"];
const STATUS = ["à faire", "en cours", "fait"];
const TAGS = {
  athlete: { bg: "#e6eae9", fg: "#37413f", prefix: "Athlète · " },
  team: { bg: "#dbe7f0", fg: "#24506f", prefix: "Équipe · " },
  club: { bg: "#f6ecdc", fg: "#7a4f15", prefix: "" },
};

function parse(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateLabel(iso: string | null, today: string, short: boolean) {
  if (!iso) return "Sans date";
  const diff = Math.round((parse(iso).getTime() - parse(today).getTime()) / 86400000);
  if (diff === 0) return short ? "Auj." : "Aujourd’hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  const d = parse(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function targetOf(x: { athlete_id: string | null; team_id: string | null; for_club: number; first_name: string | null; team_name: string | null }) {
  if (x.athlete_id) return { value: `athlete:${x.athlete_id}`, kind: "athlete" as const, name: x.first_name ?? "Athlète" };
  if (x.team_id) return { value: `team:${x.team_id}`, kind: "team" as const, name: x.team_name ?? "Équipe" };
  if (x.for_club) return { value: "club", kind: "club" as const, name: "Club" };
  return { value: "", kind: null, name: "" };
}

function Tag({ kind, name, max = 110 }: { kind: keyof typeof TAGS | null; name: string; max?: number }) {
  if (!kind) return null;
  const t = TAGS[kind];
  return (
    <span className="shrink-0 truncate rounded-full px-2 py-px text-[11px] font-semibold" style={{ maxWidth: max, background: t.bg, color: t.fg }}>
      {name}
    </span>
  );
}

function PlusButton({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-moss text-white transition-colors hover:bg-moss-dark"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
        <path d="M10 4v12M4 10h12" />
      </svg>
    </button>
  );
}

const fld = "rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-moss";
const lbl = "flex flex-col gap-1 text-[11px] font-semibold text-slate";
const smallBtn = "rounded-full bg-moss px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-moss-dark disabled:opacity-50";

function TargetSelect({ value, onChange, targets, emptyLabel }: { value: string; onChange: (v: string) => void; targets: Target[]; emptyLabel: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={fld}>
      <option value="">{emptyLabel}</option>
      {targets.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

function TaskForm({
  initial,
  targets,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { content: string; target: string; date: string; time: string };
  targets: Target[];
  submitLabel: string;
  onSubmit: (v: { content: string; target: string; date: string; time: string }) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const submit = () => v.content.trim() && onSubmit({ ...v, content: v.content.trim(), time: v.date ? v.time : "" });
  return (
    <div className="mb-1.5 flex flex-wrap items-end gap-2 rounded-xl bg-paper p-2.5">
      <label className={`${lbl} basis-full`}>
        Titre
        <input
          autoFocus
          value={v.content}
          onChange={(e) => setV({ ...v, content: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ex. Appeler Hugo pour son test"
          className={fld}
        />
      </label>
      <label className={lbl}>
        Pour
        <TargetSelect value={v.target} onChange={(target) => setV({ ...v, target })} targets={targets} emptyLabel="Personne en particulier" />
      </label>
      <label className={lbl}>
        Date
        <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={fld} />
      </label>
      <label className={lbl}>
        Heure
        <input type="time" value={v.time} disabled={!v.date} onChange={(e) => setV({ ...v, time: e.target.value })} className={`${fld} disabled:opacity-50`} />
      </label>
      <span className="flex-1" />
      {onCancel && (
        <button type="button" onClick={onCancel} className="px-1 py-1.5 text-xs font-semibold text-slate hover:text-ink">
          Annuler
        </button>
      )}
      <button type="button" onClick={submit} className={smallBtn}>
        {submitLabel}
      </button>
    </div>
  );
}

function NoteForm({
  initial,
  targets,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { body: string; target: string };
  targets: Target[];
  submitLabel: string;
  onSubmit: (v: { body: string; target: string }) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="mb-1.5 flex flex-col gap-2 rounded-xl bg-paper p-2.5">
      <label className={lbl}>
        Note
        <textarea
          autoFocus
          rows={3}
          value={v.body}
          onChange={(e) => setV({ ...v, body: e.target.value })}
          placeholder="Ce que vous voulez garder en tête…"
          className={`${fld} resize-none`}
        />
      </label>
      <div className="flex items-end gap-2">
        <label className={lbl}>
          Pour (facultatif)
          <TargetSelect value={v.target} onChange={(target) => setV({ ...v, target })} targets={targets} emptyLabel="Personne en particulier" />
        </label>
        <span className="flex-1" />
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-1 py-1.5 text-xs font-semibold text-slate hover:text-ink">
            Annuler
          </button>
        )}
        <button type="button" onClick={() => v.body.trim() && onSubmit({ ...v, body: v.body.trim() })} className={smallBtn}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function Ring({ level, onClick }: { level: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Statut : ${STATUS[level]} (cliquer pour avancer)`}
      title={`Statut : ${STATUS[level]}`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
    >
      <svg width="18" height="18" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill="none" stroke="#e3e7e6" strokeWidth="2.6" />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill={level === 2 ? "#1b4b4f" : "transparent"}
          stroke={RING[level]}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="56.55"
          transform="rotate(-90 11 11)"
          style={{ strokeDashoffset: 56.55 * (1 - level / 2), transition: "stroke-dashoffset .4s ease, fill .25s ease .15s, stroke .25s" }}
        />
        <path
          d="M6.8 11.4l2.9 2.9 5.6-6"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: level === 2 ? 1 : 0, transition: "opacity .2s ease .25s" }}
        />
      </svg>
    </button>
  );
}

const levelOf = (t: DeskTask) => (t.done_at ? 2 : t.in_progress ? 1 : 0);

// Accueil coach : tâches (statut en trois temps : à faire, en cours, fait) et
// notes, côte à côte. Pense-bête personnel, jamais visible par les athlètes.
export function CoachDesk({ tasks, notes, targets, today }: { tasks: DeskTask[]; notes: DeskNote[]; targets: Target[]; today: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  // Copies locales pour un affichage immédiat, resynchronisées quand le
  // serveur renvoie de nouvelles listes (après router.refresh()).
  const [items, setItems] = useState(tasks);
  const [srcTasks, setSrcTasks] = useState(tasks);
  if (srcTasks !== tasks) {
    setSrcTasks(tasks);
    setItems(tasks);
  }
  const [noteItems, setNoteItems] = useState(notes);
  const [srcNotes, setSrcNotes] = useState(notes);
  if (srcNotes !== notes) {
    setSrcNotes(notes);
    setNoteItems(notes);
  }
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);

  const refresh = () => start(() => router.refresh());
  const labelFor = (value: string) => targets.find((t) => t.value === value)?.label.replace(/^(Athlète|Équipe) · /, "") ?? "";
  const withTarget = <T extends DeskTask | DeskNote>(x: T, value: string): T => ({
    ...x,
    athlete_id: value.startsWith("athlete:") ? value.slice(8) : null,
    team_id: value.startsWith("team:") ? value.slice(5) : null,
    for_club: value === "club" ? 1 : 0,
    first_name: value.startsWith("athlete:") ? labelFor(value) : null,
    team_name: value.startsWith("team:") ? labelFor(value) : null,
  });

  const done = items.filter((t) => t.done_at).length;
  const sorted = [...items].sort((a, b) => {
    const la = levelOf(a) === 2 ? 1 : 0;
    const lb = levelOf(b) === 2 ? 1 : 0;
    if (la !== lb) return la - lb;
    const ka = `${a.due_date ?? "9999-99-99"}|${a.due_time ?? "99:99"}`;
    const kb = `${b.due_date ?? "9999-99-99"}|${b.due_time ?? "99:99"}`;
    return ka.localeCompare(kb) || b.created_at.localeCompare(a.created_at);
  });
  const visible = hideDone ? sorted.filter((t) => !t.done_at) : sorted;

  function cycle(t: DeskTask) {
    const next = (levelOf(t) + 1) % 3;
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, in_progress: next === 1 ? 1 : 0, done_at: next === 2 ? new Date().toISOString() : null } : x)));
    if (!t.id.startsWith("tmp-")) setCoachReminderStatusAction(t.id, next).then(refresh);
  }

  async function addTask(v: { content: string; target: string; date: string; time: string }) {
    const tmp: DeskTask = withTarget(
      { id: `tmp-${Date.now()}`, content: v.content, due_date: v.date || null, due_time: v.time || null, done_at: null, in_progress: 0, athlete_id: null, team_id: null, for_club: 0, first_name: null, team_name: null, created_at: new Date().toISOString() },
      v.target
    );
    setItems((prev) => [tmp, ...prev]);
    setAdding(false);
    const fd = new FormData();
    fd.set("content", v.content);
    fd.set("target", v.target);
    if (v.date) fd.set("dueDate", v.date);
    if (v.time) fd.set("dueTime", v.time);
    const res = await addCoachReminderAction(fd);
    if (res?.id) setItems((prev) => prev.map((x) => (x.id === tmp.id ? { ...x, id: res.id } : x)));
    refresh();
  }

  function saveTask(t: DeskTask, v: { content: string; target: string; date: string; time: string }) {
    setItems((prev) => prev.map((x) => (x.id === t.id ? withTarget({ ...x, content: v.content, due_date: v.date || null, due_time: v.time || null }, v.target) : x)));
    setEditing(null);
    updateCoachReminderAction(t.id, { content: v.content, target: v.target, dueDate: v.date || null, dueTime: v.time || null }).then(refresh);
  }

  function removeTask(t: DeskTask) {
    setItems((prev) => prev.filter((x) => x.id !== t.id));
    setOpen(null);
    if (!t.id.startsWith("tmp-")) deleteCoachReminderAction(t.id).then(refresh);
  }

  async function addNote(v: { body: string; target: string }) {
    const tmp: DeskNote = withTarget(
      { id: `tmp-${Date.now()}`, body: v.body, athlete_id: null, team_id: null, for_club: 0, first_name: null, team_name: null, created_at: today },
      v.target
    );
    setNoteItems((prev) => [tmp, ...prev]);
    setAddingNote(false);
    const res = await addCoachDeskNoteAction(v.body, v.target);
    if ("id" in res) setNoteItems((prev) => prev.map((x) => (x.id === tmp.id ? { ...x, id: res.id } : x)));
    refresh();
  }

  function saveNote(n: DeskNote, v: { body: string; target: string }) {
    setNoteItems((prev) => prev.map((x) => (x.id === n.id ? withTarget({ ...x, body: v.body }, v.target) : x)));
    setNoteEditing(null);
    updateCoachDeskNoteAction(n.id, v.body, v.target).then(refresh);
  }

  function removeNote(n: DeskNote) {
    setNoteItems((prev) => prev.filter((x) => x.id !== n.id));
    setNoteOpen(null);
    if (!n.id.startsWith("tmp-")) deleteCoachDeskNoteAction(n.id).then(refresh);
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* Tâches */}
      <section className="flex flex-col rounded-[18px] border border-line bg-white px-3 pb-1 pt-2">
        <div className="flex items-center gap-2.5 px-0.5 pb-1.5">
          <h2 className="flex-1 font-display text-[17px] font-semibold text-moss">Tâches</h2>
          <span title="Tâches faites sur le total" className="text-sm font-bold text-moss">
            {done}/{items.length}
          </span>
          <PlusButton open={adding} label="Nouvelle tâche" onClick={() => setAdding(!adding)} />
        </div>
        {adding && <TaskForm initial={{ content: "", target: "club", date: "", time: "" }} targets={targets} submitLabel="Ajouter" onSubmit={addTask} />}
        {items.length === 0 && !adding && <p className="border-t border-[#eef0ef] px-0.5 py-3 text-sm text-slate">Aucune tâche pour l’instant.</p>}
        {visible.map((t) => {
          const level = levelOf(t);
          const tg = targetOf(t);
          const late = level < 2 && !!t.due_date && t.due_date < today;
          const isOpen = open === t.id;
          const dateColor = late ? "#b4532f" : t.due_date ? "#37413f" : "#9aa39c";
          return (
            <div key={t.id} className="border-t border-[#eef0ef]">
              <div className="flex h-[34px] items-center gap-2 rounded-lg px-0.5 hover:bg-[#f5f7f6]">
                <Ring level={level} onClick={() => cycle(t)} />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(isOpen ? null : t.id);
                    setEditing(null);
                  }}
                  aria-expanded={isOpen}
                  className="flex h-[34px] min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className={`min-w-0 flex-1 truncate text-sm ${level === 2 ? "text-[#9aa39c] line-through" : "text-ink"}`}>{t.content}</span>
                  <Tag kind={tg.kind} name={tg.name} />
                  <span className="w-[76px] shrink-0 whitespace-nowrap text-right text-xs" style={{ color: dateColor, fontWeight: late ? 700 : 400 }}>
                    {dateLabel(t.due_date, today, true)}
                    {t.due_time ? ` ${t.due_time}` : ""}
                  </span>
                </button>
              </div>
              {isOpen &&
                (editing === t.id ? (
                  <div className="mb-2 ml-[38px] mr-0.5">
                    <TaskForm
                      initial={{ content: t.content, target: tg.value, date: t.due_date ?? "", time: t.due_time ?? "" }}
                      targets={targets}
                      submitLabel="Enregistrer"
                      onSubmit={(v) => saveTask(t, v)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                ) : (
                  <div className="mb-2 ml-[38px] mr-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[10px] bg-paper px-2.5 py-2 text-xs">
                    <span>
                      <span className="text-slate">Pour </span>
                      <b>{tg.kind ? `${TAGS[tg.kind].prefix}${tg.name}` : "Personne en particulier"}</b>
                    </span>
                    <span>
                      <span className="text-slate">Date </span>
                      <b style={{ color: dateColor }}>{dateLabel(t.due_date, today, false)}</b>
                    </span>
                    <span>
                      <span className="text-slate">Heure </span>
                      <b>{t.due_time || "—"}</b>
                    </span>
                    <span className="flex-1" />
                    <button type="button" onClick={() => setEditing(t.id)} className="p-1 font-semibold text-moss-dark hover:underline">
                      Modifier
                    </button>
                    <button type="button" onClick={() => removeTask(t)} className="p-1 font-semibold text-clay hover:underline">
                      Supprimer
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
        {done > 0 && (
          <div className="flex justify-end border-t border-[#eef0ef]">
            <button type="button" onClick={() => setHideDone(!hideDone)} className="px-0.5 py-[7px] text-xs font-semibold text-moss-dark hover:underline">
              {hideDone ? `Afficher les tâches faites (${done})` : `Masquer les tâches faites (${done})`}
            </button>
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="flex flex-col rounded-[18px] border border-line bg-white px-3 pb-1.5 pt-2">
        <div className="flex items-center gap-2.5 px-0.5 pb-1.5">
          <h2 className="flex-1 font-display text-[17px] font-semibold text-moss">Notes</h2>
          <span className="text-sm font-bold text-moss">{noteItems.length}</span>
          <PlusButton open={addingNote} label="Nouvelle note" onClick={() => setAddingNote(!addingNote)} />
        </div>
        {addingNote && <NoteForm initial={{ body: "", target: "" }} targets={targets} submitLabel="Ajouter" onSubmit={addNote} />}
        {noteItems.length === 0 && !addingNote && <p className="border-t border-[#eef0ef] px-0.5 py-3 text-sm text-slate">Aucune note pour l’instant.</p>}
        {noteItems.map((n) => {
          const tg = targetOf(n);
          const isOpen = noteOpen === n.id;
          return (
            <div key={n.id} className="border-t border-[#eef0ef]">
              <button
                type="button"
                onClick={() => {
                  setNoteOpen(isOpen ? null : n.id);
                  setNoteEditing(null);
                }}
                aria-expanded={isOpen}
                className="flex min-h-[34px] w-full items-center gap-2 rounded-lg px-0.5 text-left hover:bg-[#f5f7f6]"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9aa39c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M5 3.5h7l3 3v10H5zM12 3.5v3h3M8 10h4.5M8 13h4.5" />
                </svg>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{n.body.split("\n")[0]}</span>
                <Tag kind={tg.kind} name={tg.name} max={90} />
                <span className="w-[58px] shrink-0 text-right text-xs text-[#9aa39c]">{dateLabel(n.created_at, today, true)}</span>
              </button>
              {isOpen &&
                (noteEditing === n.id ? (
                  <div className="mb-2 ml-6 mr-0.5">
                    <NoteForm initial={{ body: n.body, target: tg.value }} targets={targets} submitLabel="Enregistrer" onSubmit={(v) => saveNote(n, v)} onCancel={() => setNoteEditing(null)} />
                  </div>
                ) : (
                  <div className="mb-2 ml-6 mr-0.5 flex flex-col gap-1 rounded-[10px] bg-paper px-2.5 py-2">
                    <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{n.body}</p>
                    <div className="flex justify-end gap-1 text-xs">
                      <button type="button" onClick={() => setNoteEditing(n.id)} className="p-1 font-semibold text-moss-dark hover:underline">
                        Modifier
                      </button>
                      <button type="button" onClick={() => removeNote(n)} className="p-1 font-semibold text-clay hover:underline">
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
