import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutById, getBlocksForWorkout, getCommentsForWorkout, getAthletesForCoach } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, sportLabel } from "@/components/ui";
import { StatusForm } from "./status-form";
import { CommentForm } from "./comment-form";
import { CancelWorkoutButton } from "./cancel-button";
import { DuplicateWorkoutButton } from "./duplicate-workout-modal";
import { IntervalList } from "./interval-list";

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

const QUALITY_LABELS: Record<string, string> = {
  force_max: "Force maximale",
  explosivite: "Explosivité / puissance",
  force_endurance: "Force-endurance",
  cardio: "Cardio / conditionnement",
};
const QUALITY_STYLES: Record<string, string> = {
  force_max: "bg-moss/10 text-moss-dark",
  explosivite: "bg-gold-light/15 text-gold-light",
  force_endurance: "bg-status-postponed/15 text-status-postponed",
  cardio: "bg-clay/15 text-clay",
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
  // Un brouillon n'existe pas encore pour l'athlète, y compris par URL directe.
  if (workout.is_draft && workout.coach_id !== user.id) {
    notFound();
  }

  const [blocks, comments, coachAthletes] = await Promise.all([
    getBlocksForWorkout(id),
    getCommentsForWorkout(id),
    user.role === "coach" ? getAthletesForCoach(user.id) : Promise.resolve([]),
  ]);
  const otherAthletes = coachAthletes
    .filter((a): a is typeof a & { athlete_id: string; first_name: string; last_name: string } =>
      !!a.athlete_id && a.athlete_id !== workout.athlete_id && a.status === "active"
    )
    .map((a) => ({ athlete_id: a.athlete_id, first_name: a.first_name, last_name: a.last_name }));

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
            {user.role === "coach" && (
              <div className="flex items-center gap-3">
                <Link href={`/workouts/${workout.id}/edit`} className="text-sm font-semibold text-moss-dark hover:underline">
                  Modifier
                </Link>
                <DuplicateWorkoutButton workoutId={workout.id} athleteId={workout.athlete_id} otherAthletes={otherAthletes} />
                <CancelWorkoutButton workoutId={workout.id} />
              </div>
            )}
            {user.role === "athlete" && (
              <a
                href={`/api/workouts/${workout.id}/fit`}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-ink"
                title="Fichier .fit à copier dans le dossier NEWFILES de votre montre Garmin connectée en USB"
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M3 15.5v1a2 2 0 002 2h10a2 2 0 002-2v-1" />
                </svg>
                Télécharger pour ma montre (.fit)
              </a>
            )}
          </div>
        </div>

        {workout.completion_photo_path && (
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">📸 Photo de la séance</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/workouts/${workout.id}/completion-photo`}
              alt="Photo prise à la validation de la séance"
              className="max-h-80 w-full rounded-2xl object-cover"
            />
          </Card>
        )}

        {workout.intervals_json && (
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Structure de la séance</h2>
            <IntervalList json={workout.intervals_json} />
          </Card>
        )}

        {workout.links_json && JSON.parse(workout.links_json).length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Liens utiles</h2>
            <ul className="flex flex-col gap-1.5">
              {(JSON.parse(workout.links_json) as { label: string; url: string }[]).map((l, i) => (
                <li key={i}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm text-moss-dark underline hover:text-moss">
                    🔗 {l.label || l.url}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {workout.description && (
          <Card className="mb-6">
            <p className="whitespace-pre-line text-sm text-ink">{workout.description}</p>
          </Card>
        )}

        {blocks.length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Structure de la séance</h2>
            <div className="flex flex-col gap-3">
              {(() => {
                const segments: { circuitId: string | null; rounds?: number; blocks: any[] }[] = [];
                for (const b of blocks) {
                  const last = segments[segments.length - 1];
                  if (b.circuit_id && last && last.circuitId === b.circuit_id) {
                    last.blocks.push(b);
                  } else {
                    segments.push({ circuitId: b.circuit_id || null, rounds: b.circuit_rounds, blocks: [b] });
                  }
                }

                const renderBlock = (b: any) => (
                  <div key={b.id} className="border-l-2 border-moss/40 pl-3">
                    <p className="text-xs uppercase tracking-wide text-slate">{BLOCK_TITLES[b.block_type]}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{b.exercise_name}</p>
                      {b.training_quality && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${QUALITY_STYLES[b.training_quality]}`}>
                          {QUALITY_LABELS[b.training_quality]}
                        </span>
                      )}
                    </div>
                    {b.exerciseSets?.length > 0 && (
                      <table className="mt-1 text-sm text-slate">
                        <tbody>
                          {b.exerciseSets.map((s: any) => (
                            <tr key={s.id}>
                              <td className="pr-3 text-ink-soft">Série {s.set_number}</td>
                              <td className="pr-3">
                                {b.rep_type === "time" ? "⏱ " : ""}
                                {s.reps || "—"}
                              </td>
                              <td className="pr-3">{s.load || "—"}</td>
                              {s.rest_seconds && <td className="pr-3 text-xs">Repos {s.rest_seconds}s</td>}
                              {s.rpe && <td className="text-xs">RPE {s.rpe}</td>}
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
                );

                return segments.map((segment, i) => {
                  if (!segment.circuitId) return <div key={`s${i}`}>{segment.blocks.map(renderBlock)}</div>;
                  return (
                    <div key={segment.circuitId} className="rounded-xl border-2 border-dashed border-moss/40 p-3">
                      <p className="mb-2 text-sm font-semibold text-moss-dark">🔁 Circuit — {segment.rounds || 3} tours</p>
                      <div className="flex flex-col gap-3">{segment.blocks.map(renderBlock)}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>
        )}

        {(workout.status !== "planned" || workout.rpe) && (
          <Card className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-ink-soft">Retour de l&apos;athlète</h2>
            <p className="text-sm text-ink">
              {workout.rpe ? `RPE ${workout.rpe}/10` : "Pas de RPE renseigné"}
              {workout.actual_duration_minutes ? ` · ${workout.actual_duration_minutes} min réelles` : ""}
              {workout.distance_km ? ` · ${workout.distance_km} km` : ""}
              {workout.avg_hr ? ` · FC moy. ${workout.avg_hr}` : ""}
              {workout.elevation_gain_m ? ` · D+ ${workout.elevation_gain_m} m` : ""}
              {workout.avg_power_w ? ` · ${workout.avg_power_w} W moy.` : ""}
            </p>
            {workout.athlete_feedback && <p className="mt-1 text-sm text-ink-soft">{workout.athlete_feedback}</p>}
          </Card>
        )}

        {user.role === "athlete" && (
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Mettre à jour le statut de la séance</h2>
            <StatusForm workoutId={workout.id} currentStatus={workout.status} sport={workout.sport} />
          </Card>
        )}

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Commentaires</h2>
          <div className="mb-4 flex flex-col gap-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md bg-paper-dim p-2 text-sm">
                <p className="text-ink">{c.body}</p>
                {c.video_path && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video controls className="mt-2 max-w-xs rounded-md bg-ink" src={`/api/workout-comments/${c.id}/video`} />
                )}
                <p className="mt-1 text-xs text-slate">
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
