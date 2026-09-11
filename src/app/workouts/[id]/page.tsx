import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutById, getBlocksForWorkout, getCommentsForWorkout } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, sportLabel } from "@/components/ui";
import { StatusForm } from "./status-form";
import { CommentForm } from "./comment-form";
import { CancelWorkoutButton } from "./cancel-button";

const BLOCK_TITLES: Record<string, string> = {
  warmup_mobility: "Échauffement — Mobilité",
  warmup_plyo: "Échauffement — Pliométrie",
  warmup_proprio: "Échauffement — Proprioception",
  main: "Corps de séance — Exercice principal",
  secondary: "Corps de séance — Exercice secondaire",
  complementary: "Corps de séance — Exercice complémentaire",
  specific: "Corps de séance — Exercice spécifique",
  core: "Gainage",
  cooldown: "Retour au calme",
};

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const workout = await getWorkoutById(id);
  if (!workout) notFound();

  // Garde de permission : seul le coach auteur ou l'athlète concerné peut voir la séance.
  if (workout.coach_id !== user.id && workout.athlete_id !== user.id) {
    notFound();
  }

  const blocks = await getBlocksForWorkout(id);
  const comments = await getCommentsForWorkout(id);

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-slate">
              {sportLabel(workout.sport)} · {workout.date}
              {workout.time ? ` à ${workout.time}` : ""}
              {workout.duration_minutes ? ` · ${workout.duration_minutes} min prévues` : ""}
            </p>
            <h1 className="font-display text-3xl text-ink">{workout.title}</h1>
            <p className="mt-1 text-sm text-slate">
              Programmée par {workout.coach_first_name} {workout.coach_last_name}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {workout.priority && (
                <span className="rounded-full bg-clay px-2 py-0.5 text-xs font-semibold text-white">
                  Priorité {workout.priority}
                </span>
              )}
              <StatusBadge status={workout.status} />
            </div>
            {user.role === "coach" && <CancelWorkoutButton workoutId={workout.id} />}
          </div>
        </div>

        {workout.description && (
          <Card className="mb-6">
            <p className="whitespace-pre-line text-sm text-ink">{workout.description}</p>
          </Card>
        )}

        {blocks.length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Structure de la séance</h2>
            <div className="flex flex-col gap-3">
              {blocks.map((b) => (
                <div key={b.id} className="border-l-2 border-moss/40 pl-3">
                  <p className="text-xs uppercase tracking-wide text-slate">{BLOCK_TITLES[b.block_type]}</p>
                  <p className="font-medium text-ink">{b.exercise_name}</p>
                  {b.exerciseSets?.length > 0 && (
                    <table className="mt-1 text-sm text-slate">
                      <tbody>
                        {b.exerciseSets.map((s: any) => (
                          <tr key={s.id}>
                            <td className="pr-3 text-ink-soft">Série {s.set_number}</td>
                            <td className="pr-3">{s.reps || "—"}</td>
                            <td>{s.load || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {b.notes && <p className="text-sm text-ink-soft">{b.notes}</p>}
                  {b.resource_id && (
                    <div className="mt-2 max-w-xs overflow-hidden rounded-md border border-line">
                      {b.resource_type === "video" ? (
                        <video controls className="aspect-video w-full bg-ink">
                          <source src={`/api/resources/file/${b.resource_id}`} type={b.resource_mime_type} />
                        </video>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/resources/file/${b.resource_id}`}
                          alt={b.resource_title}
                          className="aspect-video w-full object-cover"
                        />
                      )}
                      <p className="bg-paper-dim px-2 py-1 text-xs text-slate">{b.resource_title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {(workout.status !== "planned" || workout.rpe) && (
          <Card className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-ink-soft">Retour de l&apos;athlète</h2>
            <p className="text-sm text-ink">
              {workout.rpe ? `RPE ${workout.rpe}/10` : "Pas de RPE renseigné"}
              {workout.actual_duration_minutes ? ` · ${workout.actual_duration_minutes} min réelles` : ""}
            </p>
            {workout.athlete_feedback && <p className="mt-1 text-sm text-ink-soft">{workout.athlete_feedback}</p>}
          </Card>
        )}

        {user.role === "athlete" && (
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Mettre à jour le statut de la séance</h2>
            <StatusForm workoutId={workout.id} currentStatus={workout.status} />
          </Card>
        )}

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Commentaires</h2>
          <div className="mb-4 flex flex-col gap-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md bg-paper-dim p-2 text-sm">
                <p className="text-ink">{c.body}</p>
                <p className="text-xs text-slate">
                  {c.first_name} {c.last_name} · {c.role === "coach" ? "coach" : "athlète"} · {c.created_at.slice(0, 16)}
                </p>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sm text-slate">Aucun commentaire pour l&apos;instant.</p>}
          </div>
          <CommentForm workoutId={workout.id} />
        </Card>
      </main>
    </div>
  );
}
