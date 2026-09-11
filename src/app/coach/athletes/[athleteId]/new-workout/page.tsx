import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import { getResourcesForCoach, getCoachExerciseHistory } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { WorkoutForm } from "./workout-form";

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

  const rawResources = await getResourcesForCoach(user.id);
  const resources = rawResources.map((r) => ({ id: r.id, title: r.title, type: r.type }));
  const exerciseHistory = await getCoachExerciseHistory(user.id);

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Nouvelle séance</h1>
        <p className="mb-8 text-slate">
          Pour {athlete.first_name} {athlete.last_name}
        </p>
        <WorkoutForm athleteId={athleteId} resources={resources} exerciseHistory={exerciseHistory} />
      </main>
    </div>
  );
}
