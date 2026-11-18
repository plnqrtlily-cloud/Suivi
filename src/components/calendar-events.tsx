"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, Field, TextAreaField, ErrorText } from "@/components/ui";
import { DaysPicker } from "@/components/days-picker";
import { dateRangeToList } from "@/components/date-range-picker";
import { createCalendarEventAction, deleteCalendarEventAction, updateCalendarEventAction } from "@/lib/calendar-event-actions";
import { MtbPicker } from "@/components/mtb-picker";
import { Linkify } from "@/components/linkify";
import { EVENT_KINDS, TRAINING_SPORTS, guessMtbFromTitle, guessSportFromTitle, eventKind, eventSubtitle, type CalendarEventView } from "@/lib/calendar-event-kinds";

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
  initialKind,
  onDone,
  onCancel,
}: {
  /** Côté coach : l'athlète dont on modifie le calendrier. */
  athleteId?: string;
  event?: CalendarEventView;
  defaultDate: string;
  /** Type présélectionné (ex. « entrainement » depuis l'option Entraînement). */
  initialKind?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<string>(event?.kind ?? initialKind ?? "competition");
  const [dates, setDates] = useState<string[]>(event ? dateRangeToList(event.startDate, event.endDate) : [defaultDate]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const singleDay = dates.length === 1;
  // Entraînement : le sport suit le titre (« Muscu… » → Musculation) tant
  // qu'il n'a pas été choisi à la main.
  const [sport, setSport] = useState<string>(event?.discipline ? "mtb" : (event?.sport ?? "mtb"));
  const [sportTouched, setSportTouched] = useState(!!event?.sport);
  const [mtb, setMtb] = useState<string | null>(event?.discipline && event.discipline !== "mtb" ? event.discipline : null);
  const [mtbTouched, setMtbTouched] = useState(!!event?.discipline);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dates.length) return setError("Choisissez au moins un jour.");
    const fd = new FormData(e.currentTarget);
    const input = {
      athleteId,
      kind,
      title: String(fd.get("title") || ""),
      dates,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      time: singleDay ? String(fd.get("time") || "") : "",
      location: String(fd.get("location") || ""),
      notes: String(fd.get("notes") || ""),
      sport: String(fd.get("sport") || ""),
      discipline: sport === "mtb" ? mtb : null,
      durationMinutes: Number(fd.get("durationMinutes") || 0) || undefined,
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
      {/* Depuis l'option Entraînement, le type est déjà choisi ; depuis
          Événement, on propose les autres types. En modification, tous. */}
      {!(initialKind === "entrainement" && !event) && (
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Type</span>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_KINDS.filter((k) => event || k.value !== "entrainement").map((k) => (
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
      )}
      <Field
        label="Titre"
        name="title"
        required
        maxLength={120}
        defaultValue={event?.title}
        onChange={(e) => {
          const g = guessSportFromTitle(e.target.value);
          if (!sportTouched && g) setSport(g);
          const m = guessMtbFromTitle(e.target.value);
          if (!mtbTouched && m) setMtb(m);
        }} placeholder={kind === "entrainement" ? "Sortie club, séance piste…" : kind === "competition" ? "Coupe de France, manche 2" : kind === "rdv" ? "Kiné" : "Titre de l'événement"} />
      {kind === "entrainement" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
            Sport
            <select
              name="sport"
              value={sport}
              onChange={(e) => {
                setSport(e.target.value);
                setSportTouched(true);
              }}
              className="rounded-md border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-moss">
              {TRAINING_SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Durée prévue (min)" type="number" name="durationMinutes" min={0} max={1440} defaultValue={event?.durationMinutes ?? ""} />
          {sport === "mtb" && (
            <div className="col-span-2">
              <MtbPicker value={mtb} onChange={(v) => { setMtb(v); setMtbTouched(true); }} />
            </div>
          )}
        </div>
      )}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
        {/* Un événement existant reste une période continue ; à la création,
            des jours séparés donnent un événement par suite de jours. */}
        <DaysPicker value={dates} onChange={setDates} rangeOnly={!!event} />
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
          {event ? "Enregistrer" : kind === "entrainement" ? "Ajouter l'entraînement" : "Ajouter l'événement"}
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
      {event.notes && <p className="whitespace-pre-line rounded-xl bg-paper px-3 py-2.5 text-sm text-ink-soft"><Linkify text={event.notes} /></p>}
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
