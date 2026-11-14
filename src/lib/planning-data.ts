// Données de la Planification (séances + indisponibilités) sur une plage de
// dates, pour la page et pour le chargement au fil du défilement.
import { dbAll } from "./db";
import { loadWorkoutsForAthletes } from "./dashboard-batch";
import { sportLabelPlain } from "./sport-labels";
import type { PlanItem, PlanBlock, PlanStatus } from "@/app/coach/planification/planning-board";

function planStatus(status: string, date: string, today: string): PlanStatus {
  switch (status) {
    case "done":
      return "done";
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
  const [workoutsMap, blockRows] = await Promise.all([
    loadWorkoutsForAthletes(ids, start, end),
    ids.length
      ? dbAll<{ id: string; athlete_id: string; date: string; time_of_day: string; reason: string | null }>(
          `SELECT id, athlete_id, date, time_of_day, reason FROM availability_blocks WHERE athlete_id IN (${ids.map(() => "?").join(",")}) AND date BETWEEN ? AND ? ORDER BY date ASC`,
          [...ids, start, end]
        )
      : Promise.resolve([]),
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
        minutes: isGoal ? 0 : w.duration_minutes ?? 0,
        doneMinutes: w.status === "done" || w.status === "partial" ? w.actual_duration_minutes ?? w.duration_minutes ?? 0 : 0,
        status: isGoal ? "goal" : planStatus(w.status, w.date, today),
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
    label: ["Indispo", TIME_OF_DAY[b.time_of_day], b.reason].filter(Boolean).join(" · "),
  }));
  return { items, blocks, workoutsMap };
}
