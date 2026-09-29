"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCoachReminderAction,
  toggleCoachReminderAction,
  deleteCoachReminderAction,
  updateCoachReminderAction,
  clearCompletedCoachRemindersAction,
} from "@/lib/actions";
import { todayISO } from "@/lib/dates";

export interface ReminderItem {
  id: string;
  content: string;
  due_date: string | null;
  due_time?: string | null;
  notes?: string | null;
  flagged?: number | null;
  priority?: number | null;
  done_at: string | null;
  athlete_id: string | null;
  first_name?: string | null;
  created_at?: string;
}

type ListKey = "tous" | "aujourdhui" | "programmes" | "drapeau";

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(iso: string, n: number) {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateLabel(iso: string, today: string) {
  const diff = Math.round((parse(iso).getTime() - parse(today).getTime()) / 86400000);
  if (diff === 0) return "Aujourd’hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  const d = parse(iso);
  const base = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === parse(today).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
// Comme dans Rappels : à faire d'abord, puis par échéance, et à échéance égale
// dans l'ordre de création (un nouveau rappel arrive en bas de la liste).
function sortKey(r: ReminderItem) {
  const created = (r.created_at ?? "").replace(" ", "T");
  return `${r.done_at ? 1 : 0}|${r.due_date ?? "9999-99-99"}|${r.due_time ?? "99:99"}|${created}`;
}

function Circle({ done, onClick, color = "#1b4b4f" }: { done: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={done ? "Marquer comme à faire" : "Marquer comme terminé"}
      className="mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] bg-white transition-colors"
      style={{ borderColor: done ? color : "#b8c1be" }}
    >
      <span
        className="h-[14px] w-[14px] rounded-full transition-transform duration-200 ease-out"
        style={{ background: color, transform: `scale(${done ? 1 : 0})` }}
      />
    </button>
  );
}

// Pense-bête du coach, sur le modèle de l'app Rappels d'Apple : on coche un
// cercle, le rappel s'efface après un instant ; on tape directement dans la
// dernière ligne pour en créer un ; « i » ouvre le détail. Jamais visible par
// les athlètes.
export function CoachReminders({
  reminders,
  athletes,
}: {
  reminders: ReminderItem[];
  athletes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const today = todayISO();
  // Copie locale pour un affichage immédiat ; resynchronisée quand le
  // serveur renvoie une nouvelle liste (après router.refresh()).
  const [items, setItems] = useState(reminders);
  const [source, setSource] = useState(reminders);
  if (source !== reminders) {
    setSource(reminders);
    setItems(reminders);
  }
  const [list, setList] = useState<ListKey>("tous");
  const [showDone, setShowDone] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const newRef = useRef<HTMLInputElement>(null);

  const firstName = (id: string | null) => (id ? athletes.find((a) => a.id === id)?.name.split(" ")[0] ?? null : null);

  const inList = (r: ReminderItem, key: ListKey) =>
    key === "tous"
      ? true
      : key === "aujourdhui"
        ? !!r.due_date && r.due_date <= today
        : key === "programmes"
          ? !!r.due_date
          : !!r.flagged;

  const counts = useMemo(() => {
    const open = items.filter((r) => !r.done_at);
    return {
      tous: open.length,
      aujourdhui: open.filter((r) => inList(r, "aujourdhui")).length,
      programmes: open.filter((r) => inList(r, "programmes")).length,
      drapeau: open.filter((r) => inList(r, "drapeau")).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, today]);

  const doneCount = items.filter((r) => r.done_at && inList(r, list)).length;
  const visible = items
    .filter((r) => inList(r, list))
    .filter((r) => !r.done_at || showDone || leaving.has(r.id))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  function refresh() {
    start(() => router.refresh());
  }

  function patch(id: string, fields: Partial<ReminderItem>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  }

  function toggle(r: ReminderItem) {
    const done = !r.done_at;
    patch(r.id, { done_at: done ? new Date().toISOString() : null });
    if (done && !showDone) {
      setLeaving((s) => new Set(s).add(r.id));
      window.setTimeout(() => {
        setLeaving((s) => {
          const n = new Set(s);
          n.delete(r.id);
          return n;
        });
      }, 1100);
    }
    if (!r.id.startsWith("tmp-")) toggleCoachReminderAction(r.id).then(refresh);
  }

  function save(id: string, fields: Parameters<typeof updateCoachReminderAction>[1], local: Partial<ReminderItem>) {
    patch(id, local);
    if (!id.startsWith("tmp-")) updateCoachReminderAction(id, fields).then(refresh);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    setInfo(null);
    if (!id.startsWith("tmp-")) deleteCoachReminderAction(id).then(refresh);
  }

  async function create() {
    const content = draft.trim();
    if (!content) return;
    const tmp = `tmp-${Date.now()}`;
    const dueDate = list === "aujourdhui" ? today : null;
    const flagged = list === "drapeau" ? 1 : 0;
    setItems((prev) => [
      ...prev,
      { id: tmp, content, due_date: dueDate, due_time: null, notes: null, flagged, priority: 0, done_at: null, athlete_id: null, created_at: new Date().toISOString().slice(0, 19) },
    ]);
    setDraft("");
    newRef.current?.focus();
    const fd = new FormData();
    fd.set("content", content);
    if (dueDate) fd.set("dueDate", dueDate);
    if (flagged) fd.set("flagged", "1");
    const res = await addCoachReminderAction(fd);
    if (res?.id) setItems((prev) => prev.map((r) => (r.id === tmp ? { ...r, id: res.id } : r)));
    refresh();
  }

  const LISTS: { key: ListKey; label: string; color: string; icon: React.ReactNode }[] = [
    {
      key: "aujourdhui",
      label: "Aujourd’hui",
      color: "#2f6f9f",
      icon: <path d="M4 5.5h12v10.5H4zM4 8.5h12M7.5 3.5v3M12.5 3.5v3" />,
    },
    {
      key: "programmes",
      label: "Programmés",
      color: "#c9502f",
      icon: <path d="M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3.5M13 3v3.5M7 11.5h2M11 11.5h2" />,
    },
    {
      key: "tous",
      label: "Tous",
      color: "#37413f",
      icon: <path d="M4 6h1M4 10h1M4 14h1M8 6h8M8 10h8M8 14h8" />,
    },
    {
      key: "drapeau",
      label: "Avec drapeau",
      color: "#d98a2b",
      icon: <path d="M5 17V3.5M5 4h9l-2 3.5 2 3.5H5" />,
    },
  ];
  const current = LISTS.find((l) => l.key === list)!;

  return (
    <div className="flex flex-col">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LISTS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => {
              setList(l.key);
              setInfo(null);
            }}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
              list === l.key ? "bg-paper-dim ring-1 ring-line" : "hover:bg-paper-dim/60"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: l.color }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {l.icon}
                </svg>
              </span>
              <span className="text-[13px] font-semibold text-ink-soft">{l.label}</span>
            </span>
            <b className="text-lg text-ink">{counts[l.key]}</b>
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between pb-1">
        <h2 className="text-[26px] font-bold tracking-tight" style={{ color: current.color }}>
          {list === "tous" ? "Rappels" : current.label}
        </h2>
        <b className="text-[26px] font-bold tracking-tight" style={{ color: current.color }}>
          {counts[list]}
        </b>
      </div>

      <ul className="flex flex-col">
        {visible.map((r) => {
          const done = !!r.done_at;
          const late = !done && !!r.due_date && (r.due_date < today || (r.due_date === today && !!r.due_time && r.due_time < new Date().toTimeString().slice(0, 5)));
          const who = r.first_name ?? firstName(r.athlete_id);
          const open = info === r.id;
          return (
            <li
              key={r.id}
              className={`group flex gap-3 pt-2.5 transition-opacity duration-300 ${leaving.has(r.id) ? "opacity-40" : done ? "opacity-60" : ""}`}
            >
              <Circle done={done} onClick={() => toggle(r)} color={current.color} />
              <div className="min-w-0 flex-1 border-b border-line/70 pb-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {editing === r.id ? (
                      <input
                        autoFocus
                        defaultValue={r.content}
                        onBlur={(e) => {
                          const v = e.currentTarget.value.trim();
                          setEditing(null);
                          if (v && v !== r.content) save(r.id, { content: v }, { content: v });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="w-full bg-transparent text-[15px] text-ink outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditing(r.id)}
                        className={`w-full text-left text-[15px] ${done ? "text-slate" : "text-ink"}`}
                      >
                        {!!r.priority && <span className="mr-1 font-bold" style={{ color: current.color }}>{"!".repeat(r.priority)}</span>}
                        {r.content}
                      </button>
                    )}
                    {r.notes && !open && <p className="truncate text-[13px] text-slate">{r.notes}</p>}
                    {(r.due_date || who) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px]">
                        {r.due_date && (
                          <span className={late ? "text-[#d0453a]" : "text-slate"}>
                            {dateLabel(r.due_date, today)}
                            {r.due_time ? `, ${r.due_time}` : ""}
                          </span>
                        )}
                        {who && <span className="rounded-full bg-paper-dim px-2 py-0.5 text-xs text-ink-soft">{who}</span>}
                      </p>
                    )}
                  </div>
                  {!!r.flagged && (
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="#d98a2b" stroke="#d98a2b" strokeWidth="1.6" strokeLinejoin="round" className="mt-1 shrink-0" aria-label="Avec drapeau">
                      <path d="M5 17V3.5h9l-2 3.5 2 3.5H5" />
                    </svg>
                  )}
                  <button
                    type="button"
                    onClick={() => setInfo(open ? null : r.id)}
                    aria-label="Détails du rappel"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-opacity ${
                      open ? "border-moss text-moss-dark opacity-100" : "border-slate/60 text-slate opacity-0 group-hover:opacity-100 focus:opacity-100"
                    }`}
                  >
                    i
                  </button>
                </div>

                <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="min-h-0 overflow-hidden">
                    {open && (
                      <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-paper p-3">
                        <textarea
                          defaultValue={r.notes ?? ""}
                          placeholder="Notes"
                          rows={2}
                          onBlur={(e) => {
                            const v = e.currentTarget.value;
                            if (v !== (r.notes ?? "")) save(r.id, { notes: v }, { notes: v || null });
                          }}
                          className="w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <label className="flex items-center gap-2 text-slate">
                            Date
                            <input
                              type="date"
                              value={r.due_date ?? ""}
                              onChange={(e) => save(r.id, { dueDate: e.target.value || null }, { due_date: e.target.value || null })}
                              className="rounded-lg border border-line bg-white px-2 py-1 text-ink"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-slate">
                            Heure
                            <input
                              type="time"
                              value={r.due_time ?? ""}
                              onChange={(e) => save(r.id, { dueTime: e.target.value || null }, { due_time: e.target.value || null })}
                              className="rounded-lg border border-line bg-white px-2 py-1 text-ink"
                            />
                          </label>
                          <div className="flex gap-1">
                            {[
                              ["Aujourd’hui", today],
                              ["Demain", addDays(today, 1)],
                              ["Semaine pro.", addDays(today, 7)],
                            ].map(([l, d]) => (
                              <button
                                key={l}
                                type="button"
                                onClick={() => save(r.id, { dueDate: d }, { due_date: d })}
                                className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-moss-dark ring-1 ring-line hover:bg-paper-dim"
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex items-center gap-2 text-slate">
                            Athlète
                            <select
                              value={r.athlete_id ?? ""}
                              onChange={(e) =>
                                save(r.id, { athleteId: e.target.value || null }, { athlete_id: e.target.value || null, first_name: firstName(e.target.value || null) })
                              }
                              className="rounded-lg border border-line bg-white px-2 py-1 text-ink"
                            >
                              <option value="">Aucun</option>
                              {athletes.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span className="flex items-center gap-2 text-slate">
                            Priorité
                            <span className="flex rounded-full bg-paper-dim p-[3px]">
                              {["Aucune", "!", "!!", "!!!"].map((l, i) => (
                                <button
                                  key={l}
                                  type="button"
                                  onClick={() => save(r.id, { priority: i }, { priority: i })}
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${(r.priority ?? 0) === i ? "bg-white text-ink shadow-sm" : "text-slate"}`}
                                >
                                  {l}
                                </button>
                              ))}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => save(r.id, { flagged: !r.flagged }, { flagged: r.flagged ? 0 : 1 })}
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                              r.flagged ? "bg-[#fbf0e2] text-[#b06a14] ring-[#e8c48f]" : "bg-white text-slate ring-line"
                            }`}
                          >
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                              <path d="M5 17V3.5h9l-2 3.5 2 3.5H5" />
                            </svg>
                            {r.flagged ? "Avec drapeau" : "Drapeau"}
                          </button>
                          <span className="flex-1" />
                          <button type="button" onClick={() => remove(r.id)} className="text-xs font-semibold text-clay hover:underline">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}

        <li className="flex gap-3 pt-2.5">
          <span className="mt-[1px] h-[22px] w-[22px] shrink-0 rounded-full border-[1.5px] border-dashed border-line" />
          <div className="min-w-0 flex-1 pb-2.5">
            <input
              ref={newRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") setDraft("");
              }}
              onBlur={() => draft.trim() && create()}
              placeholder="Nouveau rappel"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-slate"
            />
          </div>
        </li>
      </ul>

      {visible.length === 0 && counts[list] === 0 && !draft && (
        <p className="pb-1 text-sm text-slate">
          {list === "tous" ? "Aucun rappel." : list === "aujourdhui" ? "Rien pour aujourd’hui." : list === "programmes" ? "Aucun rappel daté." : "Aucun rappel avec drapeau."}
        </p>
      )}

      {doneCount > 0 && (
        <div className="flex items-center justify-end gap-4 pt-1 text-[13px] font-semibold">
          {showDone && (
            <button
              type="button"
              onClick={() => {
                setItems((prev) => prev.filter((r) => !r.done_at));
                clearCompletedCoachRemindersAction().then(refresh);
              }}
              className="text-slate hover:text-clay"
            >
              Effacer les terminés
            </button>
          )}
          <button type="button" onClick={() => setShowDone((v) => !v)} className="text-moss-dark hover:underline">
            {showDone ? "Masquer les terminés" : `Afficher les terminés (${doneCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
