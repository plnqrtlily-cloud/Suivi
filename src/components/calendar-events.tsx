"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, Field, TextAreaField, ErrorText } from "@/components/ui";
import { DateRangePicker } from "@/components/date-range-picker";
import { createCalendarEventAction, deleteCalendarEventAction, updateCalendarEventAction } from "@/lib/calendar-event-actions";
import { EVENT_KINDS, eventKind, eventSubtitle, type CalendarEventView } from "@/lib/calendar-event-kinds";

// Événements du calendrier partagé athlète ↔ coach : formulaire (ajout et
// modification), ligne d'affichage et fenêtre de détail. Utilisés des deux
// côtés ; `you` règle le registre (« toi » chez l'athlète, « vous » chez le coach).

/** Petit drapeau coloré selon le type d'événement. */
export function EventFlag({ kind, size = 16 }: { kind: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={eventKind(kind).color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden>
      <path d="M4.5 17.5V3" />
      <path d="M4.5 3.5h10l-2.2 3.5 2.2 3.5h-10" fill={`${eventKind(kind).color}22`} />
    </svg>
  );
}

export function CalendarEventForm({
  athleteId,
  event,
  defaultDate,
  onDone,
  onCancel,
}: {
  /** Côté coach : l'athlète dont on modifie le calendrier. */
  athleteId?: string;
  event?: CalendarEventView;
  defaultDate: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<string>(event?.kind ?? "competition");
  const [start, setStart] = useState<string | null>(event?.startDate ?? defaultDate);
  const [end, setEnd] = useState<string | null>(event?.endDate ?? defaultDate);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const singleDay = !!start && (!end || end === start);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!start) return setError("Choisissez la date de l'événement.");
    const fd = new FormData(e.currentTarget);
    const input = {
      athleteId,
      kind,
      title: String(fd.get("title") || ""),
      startDate: start,
      endDate: end || start,
      time: singleDay ? String(fd.get("time") || "") : "",
      location: String(fd.get("location") || ""),
      notes: String(fd.get("notes") || ""),
    };
    setPending(true);
    setError(undefined);
    try {
      if (event) await updateCalendarEventAction(event.id, input);
      else await createCalendarEventAction(input);
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Type</span>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${kind === k.value ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-moss"}`}
            >
              <EventFlag kind={k.value} size={14} />
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Titre" name="title" required maxLength={120} defaultValue={event?.title} placeholder={kind === "competition" ? "Coupe de France, manche 2" : kind === "rdv" ? "Kiné" : "Titre de l'événement"} />
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Date(s)</span>
        <p className="mb-2 text-xs text-slate">Touchez un jour, ou un second pour un événement sur plusieurs jours.</p>
        <DateRangePicker
          start={start}
          end={end}
          onChange={({ start, end }) => {
            setStart(start);
            setEnd(end);
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {singleDay && <Field label="Heure (facultatif)" type="time" name="time" defaultValue={event?.time ?? ""} />}
        <div className={singleDay ? "" : "col-span-2"}>
          <Field label="Lieu (facultatif)" name="location" maxLength={120} defaultValue={event?.location ?? ""} placeholder="Ville, station…" />
        </div>
      </div>
      <TextAreaField label="Notes (facultatif)" name="notes" rows={2} defaultValue={event?.notes ?? ""} placeholder="Format, objectif, infos pratiques…" />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {event ? "Enregistrer" : "Ajouter l'événement"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

// Rendue dans <body> : une fenêtre ouverte depuis un en-tête fixe ou une
// carte ne doit pas rester prise sous la barre de navigation.
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-6 pb-5 shadow-2xl sm:max-w-md sm:rounded-[26px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Détail d'un événement, avec modification et suppression (par l'un ou l'autre). */
export function EventDetail({
  event,
  you,
  athleteId,
  onClose,
  onChanged,
}: {
  event: CalendarEventView;
  you: "toi" | "vous";
  athleteId?: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const other = you === "toi" ? "Ton coach sera prévenu." : "L'athlète sera prévenu.";

  async function remove() {
    if (!confirm(`Supprimer « ${event.title} » ? ${other}`)) return;
    setPending(true);
    try {
      await deleteCalendarEventAction(event.id);
      onChanged?.();
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <CalendarEventForm
        athleteId={athleteId}
        event={event}
        defaultDate={event.startDate}
        onDone={() => {
          onChanged?.();
          onClose();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <EventFlag kind={event.kind} size={20} />
        <div className="min-w-0">
          <b className="block text-base text-ink">{event.title}</b>
          <span className="block text-[13px] text-slate">{eventSubtitle(event, you)}</span>
        </div>
      </div>
      {event.notes && <p className="whitespace-pre-line rounded-xl bg-paper px-3 py-2.5 text-sm text-ink-soft">{event.notes}</p>}
      <p className="text-xs text-slate">Modifiable par {you === "toi" ? "toi et ton coach" : "vous et l'athlète"} · {other}</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          Modifier
        </Button>
        <Button type="button" variant="ghost" loading={pending} onClick={remove} className="text-[#a4492a] hover:text-[#7d3418]">
          Supprimer
        </Button>
      </div>
    </div>
  );
}

/** Ligne d'événement cliquable ; ouvre le détail dans une fenêtre. */
export function EventRow({ event, you, athleteId, compact = false }: { event: CalendarEventView; you: "toi" | "vous"; athleteId?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const color = eventKind(event.kind).color;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`flex w-full items-center gap-2.5 rounded-xl border-l-[3px] bg-white text-left ${compact ? "px-2.5 py-1.5" : "px-3 py-2.5"}`}
        style={{ borderLeftColor: color, background: `${color}0d` }}
      >
        <EventFlag kind={event.kind} size={compact ? 15 : 18} />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className={`truncate font-semibold text-ink ${compact ? "text-[13px]" : "text-[14.5px]"}`}>{event.title}</b>
          <span className="truncate text-xs text-slate">{eventSubtitle(event, you)}</span>
        </span>
      </button>
      {open && (
        <Modal title="Événement" onClose={() => setOpen(false)}>
          <EventDetail event={event} you={you} athleteId={athleteId} onClose={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

/** Bouton + fenêtre d'ajout d'un événement (pages jour, en-têtes). */
export function AddEventButton({ athleteId, defaultDate, label = "Événement" }: { athleteId?: string; defaultDate: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-moss-dark hover:border-moss"
      >
        <EventFlag kind="competition" size={14} /> {label}
      </button>
      {open && (
        <Modal title="Nouvel événement" onClose={() => setOpen(false)}>
          <CalendarEventForm athleteId={athleteId} defaultDate={defaultDate} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
