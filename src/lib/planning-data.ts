// Données de la Planification (séances + indisponibilités) sur une plage de
// dates, pour la page et pour le chargement au fil du défilement.
import { countsAsDone, countsInWeek } from "./session-status";
import { unavailabilityReason } from "./availability-kinds";
import { dbAll } from "./db";
import { loadWorkoutsForAthletes } from "./dashboard-batch";
import { sportLabelPlain } from "./sport-labels";
import { getCalendarEvents } from "./calendar-events";
import { eventKind } from "./calendar-event-kinds";
import type { PlanItem, PlanBlock, PlanStatus } from "@/app/coach/planification/planning-board";

function planStatus(status: string, date: string, today: string, validated = false): PlanStatus {
  switch (status) {
    case "done":
      return validated ? "valid" : "done";
    case "partial":
      return "part";
    case "not_done":
    case "postponed":
      return "miss";
    default:
      return date < today ? "miss" : "todo";
  }
}

const TIME_OF_DAY: Record<string, string> = {
  morning: "matin",
  midday: "midi",
  afternoon: "après-midi",
  evening: "soir",
  full_day: "",
};

export async function loadPlanningRange(coachId: string, ids: string[], start: string, end: string, today: string) {
  const [workoutsMap, blockRows, events] = await Promise.all([
    loadWorkoutsForAthletes(ids, start, end),
    ids.length
      ? dbAll<{ id: string; athlete_id: string; date: string; time_of_day: string; reason: string | null; kind: string | null }>(
          `SELECT id, athlete_id, date, time_of_day, reason, kind FROM availability_blocks WHERE athlete_id IN (${ids.map(() => "?").join(",")}) AND date BETWEEN ? AND ? ORDER BY date ASC`,
          [...ids, start, end]
        )
      : Promise.resolve([]),
    getCalendarEvents(ids, start, end, coachId),
  ]);
  const items: PlanItem[] = [];
  for (const id of ids) {
    for (const w of workoutsMap.get(id) ?? []) {
      const isGoal = w.category === "objectif" || w.category === "evenement";
      items.push({
        id: w.id,
        athleteId: id,
        date: w.date,
        title: w.title,
        sport: w.sport,
        sportLabel: sportLabelPlain(w.sport),
        minutes: isGoal || !countsInWeek(w, today) ? 0 : w.duration_minutes ?? 0,
        // Fait = retour validé par le coach.
        doneMinutes: countsAsDone(w) ? w.actual_duration_minutes ?? w.duration_minutes ?? 0 : 0,
        status: isGoal ? "goal" : planStatus(w.status, w.date, today, !!w.coach_validated_at),
        isGoal,
        isDraft: !!w.is_draft,
        mine: w.coach_id === coachId,
      });
    }
  }
  const blocks: PlanBlock[] = blockRows.map((b) => ({
    id: b.id,
    athleteId: b.athlete_id,
    date: b.date,
    label: ["Indispo", TIME_OF_DAY[b.time_of_day], unavailabilityReason(b.kind, b.reason)].filter(Boolean).join(" · "),
  }));
  // Événements partagés (compétition, stage…) : un repère coloré chaque jour
  // qu'ils couvrent, placé avant l'indisponibilité éventuelle du même jour.
  const eventBlocks: PlanBlock[] = [];
  for (const e of events) {
    for (let d = e.startDate < start ? start : e.startDate; d <= e.endDate && d <= end; d = nextDay(d)) {
      eventBlocks.push({ id: `${e.id}|${d}`, athleteId: e.athleteId, date: d, label: e.title, color: eventKind(e.kind).color, kindLabel: eventKind(e.kind).label });
    }
  }
  return { items, blocks: [...eventBlocks, ...blocks], workoutsMap };
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d + 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
