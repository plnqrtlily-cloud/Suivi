"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeFlexWorkoutAction } from "@/lib/actions";

// Séances « à placer » d'une semaine : le coach les propose, l'athlète les
// range dans les cases des jours qui lui conviennent — en les faisant glisser
// (souris, ou appui long sur certains téléphones) ou en touchant la séance puis
// le jour. Une séance placée reste déplaçable (autre case, ou retour dans le
// bac) tant qu'elle n'est pas renseignée. Le coach est prévenu à chaque fois.

export interface FlexItem {
  id: string;
  title: string;
  sportLabel: string;
  durationMinutes: number | null;
  color: string;
  /** Jour choisi, ou null tant qu'elle attend dans le bac. */
  date: string | null;
  /** Encore déplaçable (séance pas encore renseignée). */
  movable: boolean;
}

export interface DayInfo {
  /** Autres séances ou activités déjà ce jour-là. */
  busy: number;
  /** Indisponibilité posée ce jour-là. */
  unavailable: boolean;
}

const DOW = ["L", "M", "M", "J", "V", "S", "D"];

function minutes(m: number | null) {
  if (!m) return null;
  const h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`;
}

export function PlaceTray({
  dates,
  today,
  items: initial,
  days,
  you = "toi",
}: {
  dates: string[];
  today: string;
  items: FlexItem[];
  days: Record<string, DayInfo>;
  /** Registre : l'athlète (« toi ») ou le coach qui place pour lui (« vous »). */
  you?: "toi" | "vous";
}) {
  const router = useRouter();
  // Placement optimiste : la case se remplit tout de suite, la base suit.
  const [items, setItems] = useState(initial);
  const [synced, setSynced] = useState(initial);
  if (initial !== synced) {
    setSynced(initial);
    setItems(initial);
  }
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const waiting = items.filter((i) => !i.date);
  const sel = items.find((i) => i.id === selected) ?? null;

  function place(id: string, date: string | null) {
    const item = items.find((i) => i.id === id);
    if (!item || !item.movable || item.date === date) {
      setSelected(null);
      return;
    }
    const before = items;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, date } : i)));
    setSelected(null);
    setError(null);
    startTransition(async () => {
      try {
        await placeFlexWorkoutAction(id, date);
        router.refresh();
      } catch (e) {
        setItems(before);
        setError(e instanceof Error ? e.message : "Impossible de placer la séance.");
      }
    });
  }

  const chip = (i: FlexItem, compact = false) => (
    <button
      key={i.id}
      type="button"
      draggable={i.movable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", i.id);
        e.dataTransfer.effectAllowed = "move";
        setSelected(i.id);
      }}
      onDragEnd={() => setOver(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (!i.movable) return;
        setSelected((s) => (s === i.id ? null : i.id));
      }}
      title={i.movable ? "Glisser dans un jour, ou toucher puis choisir le jour" : "Séance déjà renseignée"}
      className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border bg-white text-left transition-shadow ${compact ? "px-1.5 py-1" : "px-2.5 py-2"} ${
        selected === i.id ? "border-[#1b4b4f] shadow-[0_0_0_2px_#1b4b4f33]" : "border-line"
      } ${i.movable ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-70"}`}
    >
      <span className="h-full w-1 flex-shrink-0 self-stretch rounded-full" style={{ background: i.color }} />
      <span className="min-w-0">
        <span className={`block truncate font-semibold text-ink ${compact ? "text-[11px] leading-tight" : "text-[13.5px]"}`}>{i.title}</span>
        {!compact && <span className="block truncate text-[11.5px] text-slate">{[i.sportLabel, minutes(i.durationMinutes)].filter(Boolean).join(" · ")}</span>}
      </span>
    </button>
  );

  return (
    <div className="rounded-2xl border border-dashed border-[#1b4b4f]/35 bg-[#f4f8f7] p-3" onClick={() => setSelected(null)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver("tray");
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          place(e.dataTransfer.getData("text/plain"), null);
        }}
        className={`rounded-xl transition-colors ${over === "tray" ? "bg-[#e3eeed]" : ""}`}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <b className="text-[13.5px] text-ink">
            À placer{waiting.length ? ` · ${waiting.length}` : ""}
          </b>
          <span className="text-right text-[11.5px] text-slate">
            {sel ? (sel.date ? "Touche un autre jour, ou « Remettre à placer »" : "Touche le jour choisi") : waiting.length ? `Glisse${you === "vous" ? "z" : ""} dans un jour, ou touche${you === "vous" ? "z" : ""} puis choisi${you === "vous" ? "ssez" : "s"} le jour` : "Tout est placé"}
          </span>
        </div>
        {waiting.length > 0 && <div className="mb-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">{waiting.map((i) => chip(i))}</div>}
        {sel?.date && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              place(sel.id, null);
            }}
            className="mb-2 text-[12.5px] font-semibold text-moss-dark hover:underline"
          >
            ↩ Remettre « {sel.title} » à placer
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, idx) => {
          const placed = items.filter((i) => i.date === date);
          const info = days[date] ?? { busy: 0, unavailable: false };
          const target = !!sel && sel.date !== date;
          return (
            <div
              key={date}
              role="button"
              tabIndex={0}
              aria-label={`Placer le ${date}`}
              onClick={(e) => {
                e.stopPropagation();
                if (sel) place(sel.id, date);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(date);
              }}
              onDragLeave={() => setOver((o) => (o === date ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                place(e.dataTransfer.getData("text/plain"), date);
              }}
              className={`flex min-h-[86px] min-w-0 flex-col gap-1 rounded-xl border p-1 transition-colors ${
                over === date ? "border-[#1b4b4f] bg-[#e3eeed]" : target ? "border-[#1b4b4f]/50 bg-white" : "border-line bg-white/70"
              } ${info.unavailable ? "bg-[repeating-linear-gradient(135deg,#f3ece6_0,#f3ece6_5px,#faf6f2_5px,#faf6f2_10px)]" : ""}`}
            >
              <span className={`text-center text-[10.5px] font-bold uppercase ${date === today ? "text-[#a4492a]" : "text-slate"}`}>
                {DOW[idx]} {Number(date.slice(8))}
              </span>
              {placed.map((i) => chip(i, true))}
              {info.busy > 0 && (
                <span className="mt-auto text-center text-[10px] leading-tight text-slate" title="Autres séances déjà prévues ce jour-là">
                  +{info.busy} prévu{info.busy > 1 ? "s" : ""}
                </span>
              )}
              {info.unavailable && <span className="mt-auto text-center text-[10px] leading-tight text-[#7a6a5c]">Indispo</span>}
              {target && placed.length === 0 && !info.busy && !info.unavailable && <span className="m-auto text-lg leading-none text-[#1b4b4f]/50">+</span>}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[12.5px] text-[#a4492a]">{error}</p>}
    </div>
  );
}
