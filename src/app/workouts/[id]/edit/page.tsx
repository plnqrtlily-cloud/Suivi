import { redirect, notFound } from "next/navigation";
import { getCurrentUser, findUserById } from "@/lib/auth";
import { getWorkoutById, getBlocksForWorkout, getResourcesForCoach, getCoachExerciseHistory, getLatestExerciseMaxes } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { WorkoutForm } from "@/app/coach/athletes/[athleteId]/new-workout/workout-form";
import type { BlockRow } from "@/app/coach/athletes/[athleteId]/new-workout/strength-builder";
import type { IntervalItem } from "@/app/coach/athletes/[athleteId]/new-workout/interval-builder";

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { id } = await params;
  const workout = await getWorkoutById(id);
  if (!workout) notFound();
  if (workout.coach_id !== user.id) notFound();

  const [rawBlocks, athlete, rawResources, exerciseHistory, exerciseMaxes] = await Promise.all([
    getBlocksForWorkout(id),
    findUserById(workout.athlete_id),
    getResourcesForCoach(user.id),
    getCoachExerciseHistory(user.id),
    getLatestExerciseMaxes(workout.athlete_id),
  ]);
  const resources = rawResources.map((r) => ({ id: r.id, title: r.title, type: r.type }));

  const blocks: BlockRow[] = rawBlocks.map((b: any) => ({
    key: b.id,
    block_type: b.block_type,
    exercise_name: b.exercise_name,
    notes: b.notes || "",
    resource_id: b.resource_id || "",
    training_quality: b.training_quality || "",
    rep_type: b.rep_type === "time" ? "time" : "reps",
    circuit_id: b.circuit_id || undefined,
    circuit_rounds: b.circuit_rounds || undefined,
    sets:
      b.exerciseSets.length > 0
        ? b.exerciseSets.map((s: any) => ({
            reps: s.reps || "",
            load: s.load || "",
            restSeconds: s.rest_seconds ? String(s.rest_seconds) : "",
            rpe: s.rpe ? String(s.rpe) : "",
          }))
        : [{ reps: "", load: "", restSeconds: "", rpe: "" }],
  }));

  let intervals: IntervalItem[] = [];
  try {
    intervals = workout.intervals_json ? JSON.parse(workout.intervals_json) : [];
  } catch {
    intervals = []; // JSON corrompu ou vide — repart d'une structure neuve plutôt que de faire planter la page
  }

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Modifier la séance</h1>
        <p className="mb-8 text-slate">
          Pour {athlete?.first_name} {athlete?.last_name}
        </p>
        <WorkoutForm
          athleteId={workout.athlete_id}
          resources={resources}
          exerciseHistory={exerciseHistory}
          exerciseMaxes={exerciseMaxes}
          initial={{
            workoutId: workout.id,
            sport: workout.sport,
            category: workout.category,
            priority: workout.priority,
            title: workout.title,
            date: workout.date,
            time: workout.time,
            durationMinutes: workout.duration_minutes,
            description: workout.description,
            color: workout.color,
            blocks,
            intervals,
          }}
        />
      </main>
    </div>
  );
}
