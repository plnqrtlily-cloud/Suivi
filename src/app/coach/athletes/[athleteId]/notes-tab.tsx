"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CoachNoteEntry } from "@/lib/queries";
import {
  addCoachNoteEntryAction,
  updateCoachNoteEntryAction,
  deleteCoachNoteEntryAction,
} from "@/lib/actions";
import { Panel, PanelTitle, Segmented, TabHeader, linkBtn, primaryBtn, fieldClass } from "./tab-ui";

const KINDS = [
  { value: "entretien", label: "Entretien", plural: "Entretiens" },
  { value: "observation", label: "Observation", plural: "Observations" },
  { value: "decision", label: "Décision", plural: "Décisions" },
] as const;

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function shortDate(iso: string) {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function Entry({ entry }: { entry: CoachNoteEntry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const kind = KINDS.find((k) => k.value === entry.kind);

  return (
    <li className="group grid grid-cols-[76px_1fr] gap-3 border-t border-line py-4 first:border-t-0">
      <div>
        <p className="text-sm font-semibold text-ink">{shortDate(entry.entry_date)}</p>
        <p className="text-xs text-slate">{kind?.label ?? "Note"}</p>
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("entryId", entry.id);
            start(async () => {
              await updateCoachNoteEntryAction(fd);
              setEditing(false);
              router.refresh();
            });
          }}
        >
          <textarea
            name="body"
            defaultValue={entry.body}
            autoFocus
            onInput={(e) => grow(e.currentTarget)}
            ref={(el) => {
              if (el) grow(el);
            }}
            className={`${fieldClass} resize-none overflow-hidden`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select name="kind" defaultValue={entry.kind ?? ""} className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink">
              <option value="">Note</option>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <input type="date" name="entryDate" defaultValue={entry.entry_date} className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink" />
            <button type="submit" disabled={pending} className={primaryBtn}>
              Enregistrer
            </button>
            <button type="button" className={linkBtn} onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 whitespace-pre-line text-sm leading-relaxed text-ink">{entry.body}</p>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2 py-1 text-xs font-semibold text-slate hover:bg-paper-dim hover:text-ink">
              Modifier
            </button>
            <button
              type="button"
              aria-label="Supprimer la note"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Supprimer cette note ?")) return;
                const fd = new FormData();
                fd.set("entryId", entry.id);
                start(async () => {
                  await deleteCoachNoteEntryAction(fd);
                  router.refresh();
                });
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-slate hover:bg-paper-dim hover:text-clay"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Journal({ athleteId, entries }: { athleteId: string; entries: CoachNoteEntry[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "entretien" | "observation" | "decision">("all");
  const [kind, setKind] = useState<string>("observation");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  function submit() {
    const body = ref.current?.value.trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("athleteId", athleteId);
    fd.set("body", body);
    fd.set("kind", kind);
    start(async () => {
      await addCoachNoteEntryAction(fd);
      if (ref.current) {
        ref.current.value = "";
        grow(ref.current);
      }
      router.refresh();
    });
  }

  return (
    <Panel>
      <PanelTitle
        title="Journal de suivi"
        hint="visible par vous seul"
        right={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[{ value: "all", label: "Tout" }, ...KINDS.map((k) => ({ value: k.value, label: k.plural }))]}
          />
        }
      />
      <div className="mb-2 rounded-2xl border border-line bg-paper p-2 transition-colors focus-within:border-moss focus-within:bg-white">
        <textarea
          ref={ref}
          rows={2}
          placeholder="Ajouter une note (entretien, observation, décision…)"
          onInput={(e) => grow(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          className="w-full resize-none overflow-hidden bg-transparent px-2 py-1 text-sm text-ink outline-none"
        />
        <div className="flex items-center gap-1">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                kind === k.value ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink"
              }`}
            >
              {k.label}
            </button>
          ))}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            aria-label="Ajouter la note"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-moss text-white transition-colors hover:bg-moss-dark disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3 8.5 11.5M17 3l-5 14-3.5-5.5L3 8z" />
            </svg>
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-sm text-slate">{entries.length ? "Aucune note de ce type." : "Aucune note pour l'instant."}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((e) => (
            <Entry key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function NotesTab({
  athleteId,
  entries,
  profile,
  footer,
}: {
  athleteId: string;
  entries: CoachNoteEntry[];
  profile?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <TabHeader title="Notes" />
      {profile}
      <Journal athleteId={athleteId} entries={entries} />
      {footer}
    </div>
  );
}
