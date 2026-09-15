import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import { getResourcesForCoach, getCoachExerciseHistory, getLatestExerciseMaxes, getWorkoutTemplatesForCoach, getAthletesForCoach } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { WorkoutForm, type WorkoutTemplateOption } from "./workout-form";
import { TemplateList } from "./template-list";

export default async function NewWorkoutPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId } = await params;
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) notFound();
  const athlete = await findUserById(athleteId);
  if (!athlete) notFound();

  const [rawResources, exerciseHistory, exerciseMaxes, rawTemplates, allAthletes] = await Promise.all([
    getResourcesForCoach(user.id),
    getCoachExerciseHistory(user.id),
    getLatestExerciseMaxes(athleteId),
    getWorkoutTemplatesForCoach(user.id),
    getAthletesForCoach(user.id),
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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Nouvelle séance</h1>
        <p className="mb-8 text-slate">
          Pour {athlete.first_name} {athlete.last_name}
        </p>
        <TemplateList templates={templates} />
        <WorkoutForm
          athleteId={athleteId}
          resources={resources}
          exerciseHistory={exerciseHistory}
          exerciseMaxes={exerciseMaxes}
          templates={templates}
          otherAthletes={otherAthletes}
        />
      </main>
      </div>
    </div>
  );
}
