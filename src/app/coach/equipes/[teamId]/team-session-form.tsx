"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeamSessionAction } from "@/lib/actions";
import { Field, TextAreaField, Button } from "@/components/ui";
import { DateRangePicker, dateRangeToList } from "@/components/date-range-picker";
import { TIME_OF_DAY_ORDER, TIME_OF_DAY_LABELS, type TimeOfDay } from "@/lib/time-of-day";

type TimeMode = "none" | "precise" | TimeOfDay;

const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

export function TeamSessionForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const router = useRouter();
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [weekdayFilter, setWeekdayFilter] = useState<number[]>([]);
  const [timeMode, setTimeMode] = useState<TimeMode>("none");
  const [preciseTime, setPreciseTime] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setMessage(null);

    if (!rangeStart || !rangeEnd) {
      setError("Choisissez au moins un jour.");
      return;
    }
    let dates = dateRangeToList(rangeStart, rangeEnd);
    if (weekdayFilter.length > 0 && dates.length > 1) {
      dates = dates.filter((d) => weekdayFilter.includes(new Date(`${d}T00:00:00`).getDay()));
      if (dates.length === 0) {
        setError("Aucun jour ne correspond au filtre choisi.");
        return;
      }
    }

    setPending(true);
    const result = await createTeamSessionAction({
      teamId,
      title: String(formData.get("title") || ""),
      dates,
      time: timeMode === "none" ? undefined : timeMode === "precise" ? preciseTime || undefined : timeMode,
      durationMinutes: formData.get("duration") ? Number(formData.get("duration")) : undefined,
      description: String(formData.get("description") || "") || undefined,
    });
    setPending(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMessage(`${dates.length} date(s) programmée(s) pour ${result.count} joueur(s).`);
    setRangeStart(null);
    setRangeEnd(null);
    setWeekdayFilter([]);
    setTimeMode("none");
    setPreciseTime("");
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Titre de la séance" name="title" required defaultValue={`Entraînement — ${teamName}`} />

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
        <p className="mb-2 text-xs text-slate">
          Cliquez un jour pour une séance unique, ou un deuxième jour pour répéter la même séance sur toute la
          période (comme sur Booking pour un séjour) — envoyée à tout l&apos;effectif de l&apos;équipe.
        </p>
        <DateRangePicker
          start={rangeStart}
          end={rangeEnd}
          onChange={({ start, end }) => {
            setRangeStart(start);
            setRangeEnd(end);
          }}
        />
        {rangeStart && rangeEnd && rangeStart !== rangeEnd && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">
              Ne répéter que certains jours de la semaine (facultatif — sinon tous les jours de la plage)
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() =>
                    setWeekdayFilter((prev) => (prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]))
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    weekdayFilter.includes(d.value) ? "border-gold-light bg-gold-light/10 text-ink" : "border-line text-slate"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-soft font-medium">Heure (facultatif)</span>
          <div className="flex flex-wrap gap-2">
            <select
              value={timeMode}
              onChange={(e) => setTimeMode(e.target.value as TimeMode)}
              className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
            >
              <option value="none">Non précisée</option>
              <option value="precise">Heure précise</option>
              {TIME_OF_DAY_ORDER.map((slot) => (
                <option key={slot} value={slot}>
                  {TIME_OF_DAY_LABELS[slot]}
                </option>
              ))}
            </select>
            {timeMode === "precise" && (
              <input
                type="time"
                value={preciseTime}
                onChange={(e) => setPreciseTime(e.target.value)}
                className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
              />
            )}
          </div>
        </div>
        <Field label="Durée prévue (minutes)" type="number" name="duration" min={0} />
      </div>

      <TextAreaField label="Description (facultatif)" name="description" rows={3} />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Programmation…" : "Programmer pour toute l'équipe"}
        </Button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
      {message && <p className="text-sm text-moss-dark">{message}</p>}
    </form>
  );
}
