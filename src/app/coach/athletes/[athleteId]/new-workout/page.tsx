import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import { getResourcesForCoach, getCoachExerciseHistory, getLatestExerciseMaxes, getWorkoutTemplatesForCoach, getAthletesForCoach, getLatestMeasurements } from "@/lib/queries";
import { zoneLabelsFor } from "@/lib/zone-labels";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { WorkoutForm, type WorkoutTemplateOption } from "./workout-form";

function longDateFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function NewWorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId } = await params;
  // Date pré-sélectionnée quand on arrive depuis le calendrier (bouton
  // « Ajouter » → « Séance à faire » sur un jour précis).
  const { date: rawDate } = await searchParams;
  const defaultDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) notFound();
  const athlete = await findUserById(athleteId);
  if (!athlete) notFound();

  const [rawResources, exerciseHistory, exerciseMaxes, rawTemplates, allAthletes, latest] = await Promise.all([
    getResourcesForCoach(user.id),
    getCoachExerciseHistory(user.id),
    getLatestExerciseMaxes(athleteId),
    getWorkoutTemplatesForCoach(user.id),
    getAthletesForCoach(user.id),
    getLatestMeasurements(athleteId),
  ]);
  const resources = rawResources.map((r) => ({ id: r.id, title: r.title, type: r.type }));
  const templates: WorkoutTemplateOption[] = rawTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    sport: t.sport,
    category: t.category,
    duration_minutes: t.duration_minutes,
    description: t.description,
    color: t.color,
    blocks: t.blocks_json ? JSON.parse(t.blocks_json) : [],
  }));
  // Pour l'envoi groupé de la même séance à plusieurs athlètes d'un coup.
  const otherAthletes = allAthletes
    .filter((a: any) => a.status === "active" && a.athlete_id && a.athlete_id !== athleteId)
    .map((a: any) => ({ id: a.athlete_id as string, name: `${a.first_name} ${a.last_name}` }));

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <p className="text-sm text-slate">
          {athlete.first_name} {athlete.last_name}
          {defaultDate ? ` · ${longDateFr(defaultDate)}` : ""}
        </p>
        <h1 className="mb-6 text-[28px] font-bold tracking-tight text-ink">Nouvelle séance</h1>
        <WorkoutForm
          athleteId={athleteId}
          resources={resources}
          exerciseHistory={exerciseHistory}
          exerciseMaxes={exerciseMaxes}
          templates={templates}
          otherAthletes={otherAthletes}
          defaultDate={defaultDate}
          zones={zoneLabelsFor(latest)}
        />
      </main>
      </div>
    </div>
  );
}
