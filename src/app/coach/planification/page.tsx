import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { dbAll } from "@/lib/db";
import { getAthletesForCoach } from "@/lib/queries";
import { loadWorkoutsForAthletes } from "@/lib/dashboard-batch";
import { todayISO } from "@/lib/dates";
import { sportLabelPlain } from "@/lib/sport-labels";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { PlanningBoard, type PlanAthlete, type PlanItem, type PlanBlock, type PlanStatus } from "./planning-board";

// Planification : tous les athlètes sur une frise qui défile jour par jour
// (vue semaine) ou semaine par semaine (vue mois). Fenêtre chargée : 4 semaines
// avant la semaine en cours, 12 après.
const WEEKS_BEFORE = 4;
const WEEKS_TOTAL = 16;

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function mondayOf(s: string): string {
  const d = parse(s);
  return addDays(s, -((d.getDay() + 6) % 7));
}

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

export default async function PlanificationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const today = todayISO();
  const start = addDays(mondayOf(today), -7 * WEEKS_BEFORE);
  const end = addDays(start, 7 * WEEKS_TOTAL - 1);

  const links = await getAthletesForCoach(user.id);
  const active = links.filter((l) => l.status === "active" && l.athlete_id);
  const ids = active.map((l) => l.athlete_id as string);

  const [workoutsMap, sportsRows, blockRows] = await Promise.all([
    loadWorkoutsForAthletes(ids, start, end),
    ids.length
      ? dbAll<{ id: string; sports_json: string | null }>(`SELECT id, sports_json FROM users WHERE id IN (${ids.map(() => "?").join(",")})`, ids)
      : Promise.resolve([]),
    ids.length
      ? dbAll<{ id: string; athlete_id: string; date: string; time_of_day: string; reason: string | null }>(
          `SELECT id, athlete_id, date, time_of_day, reason FROM availability_blocks WHERE athlete_id IN (${ids.map(() => "?").join(",")}) AND date BETWEEN ? AND ? ORDER BY date ASC`,
          [...ids, start, end]
        )
      : Promise.resolve([]),
  ]);

  const sportsOf = new Map<string, string[]>();
  for (const r of sportsRows) {
    try {
      sportsOf.set(r.id, r.sports_json ? JSON.parse(r.sports_json) : []);
    } catch {
      sportsOf.set(r.id, []);
    }
  }

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
        mine: w.coach_id === user.id,
      });
    }
  }

  const athletes: PlanAthlete[] = active.map((l) => {
    const id = l.athlete_id as string;
    const sports = new Set(sportsOf.get(id) ?? []);
    for (const w of workoutsMap.get(id) ?? []) if (w.category === "entrainement") sports.add(w.sport);
    return {
      id,
      name: l.first_name || l.invite_first_name || "Athlète",
      fullName: [l.first_name, l.last_name].filter(Boolean).join(" ") || l.invite_first_name || "Athlète",
      avatarPath: l.avatar_path ?? null,
      sports: Array.from(sports),
    };
  });
  athletes.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const blocks: PlanBlock[] = blockRows.map((b) => ({
    id: b.id,
    athleteId: b.athlete_id,
    date: b.date,
    label: ["Indispo", TIME_OF_DAY[b.time_of_day], b.reason].filter(Boolean).join(" · "),
  }));

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/planification" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6">
          <PlanningBoard athletes={athletes} items={items} blocks={blocks} start={start} days={7 * WEEKS_TOTAL} today={today} />
        </main>
      </div>
    </div>
  );
}
