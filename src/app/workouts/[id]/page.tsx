import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { upgradeOutdatedAnimations } from "@/lib/animation-upgrade";
import { getWorkoutById, getBlocksForWorkout, getCommentsForWorkout, getAthletesForCoach, getLatestExerciseMaxes } from "@/lib/queries";
import { computeVolume, formatSeconds } from "@/lib/strength-volume";
import { formatWorkoutTime, isTimeOfDaySlug } from "@/lib/time-of-day";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, sportLabel } from "@/components/ui";
import { mtbLabel } from "@/lib/mtb";
import { PART_COLORS, partColors, partOf } from "@/lib/block-parts";
import { Linkify, safeUrl, shortUrl } from "@/components/linkify";
import { resourceFileUrl } from "@/lib/exercise-animations";
import { after } from "next/server";
import { MoreMenu, MenuSeparator, menuItem } from "@/components/more-menu";
import { parsePlan } from "@/lib/discipline";
import { formatDuration } from "@/lib/duration";
import { StatusForm } from "./status-form";
import { CommentBody } from "@/components/comment-body";
import { OpenDetailsButton } from "@/components/open-details-button";
import { MoveWorkoutItem } from "@/components/entry-menus";
import { CommentForm } from "./comment-form";
import { CancelWorkoutButton } from "./cancel-button";
import { CopyWorkoutButton, SendToAthletesButton } from "@/components/workout-clipboard";
import { PublishWorkoutButton } from "./publish-button";
import { WorkoutStructure } from "@/components/workout-structure";
import { ExerciseDetailButton, type ExerciseDetailData } from "./exercise-detail";
import { QUALITY_TIPS, animationFor, loadInKg, tempoPhases } from "@/lib/exercise-detail";

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

// Partie de la séance, suivie du type d'exercice saisi par le coach (ou, pour
// les séances d'avant la saisie libre, du libellé de l'ancienne liste).
const GROUP_OF: Record<string, string> = {
  warmup_mobility: "Échauffement",
  warmup_plyo: "Échauffement",
  warmup_proprio: "Échauffement",
  main: "Corps de séance",
  secondary: "Corps de séance",
  complementary: "Corps de séance",
  specific: "Corps de séance",
  core: "Gainage",
  cooldown: "Retour au calme",
};
function blockTitle(b: { block_type: string; exercise_type?: string | null }): string {
  if (b.exercise_type == null) return BLOCK_TITLES[b.block_type] ?? "";
  const g = GROUP_OF[b.block_type] ?? "";
  const t = b.exercise_type.trim();
  return t && t.toLowerCase() !== g.toLowerCase() ? `${g} — ${t}` : g;
}

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

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ apercu?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { apercu } = await searchParams;
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

  // « Voir comme l'athlète » : le coach parcourt la séance exactement comme
  // l'athlète la recevra (consignes, détail des exercices), sans ses outils.
  const preview = user.role === "coach" && apercu === "athlete";
  const workoutDiscipline = parsePlan(workout.plan_json)?.discipline ?? null;
  const statusInitial =
    workout.status === "planned"
      ? undefined
      : {
          rpe: workout.rpe,
          feedback: workout.athlete_feedback,
          actualMin: workout.actual_duration_minutes,
          elapsedMin: workout.elapsed_minutes,
          distanceKm: workout.distance_km,
          avgHr: workout.avg_hr,
          elevation: workout.elevation_gain_m,
          power: workout.avg_power_w,
          routeUrl: workout.route_url,
        };
  const role = preview ? "athlete" : user.role;

  // Animations refaites depuis leur import : remplacées en arrière-plan, sans
  // retarder l'affichage (la démonstration pointe déjà vers la bonne version).
  after(() => upgradeOutdatedAnimations(workout.coach_id));

  const [blocks, comments, coachAthletes, strengthMaxes] = await Promise.all([
    getBlocksForWorkout(id),
    getCommentsForWorkout(id),
    user.role === "coach" ? getAthletesForCoach(user.id) : Promise.resolve([]),
    getLatestExerciseMaxes(workout.athlete_id),
  ]);
  const otherAthletes = coachAthletes
    .filter((a): a is typeof a & { athlete_id: string; first_name: string; last_name: string } =>
      !!a.athlete_id && a.athlete_id !== workout.athlete_id && a.status === "active"
    )
    .map((a) => ({ athlete_id: a.athlete_id, first_name: a.first_name, last_name: a.last_name }));
  const athleteFirstName = coachAthletes.find((a) => a.athlete_id === workout.athlete_id)?.first_name ?? "l'athlète";

  // Volume de musculation, calculé depuis les blocs enregistrés. Les charges en
  // pourcentage sont converties via les maxima de l'athlète quand ils existent.
  const strengthVolume = computeVolume(
    blocks.map((b: any) => ({
      exercise_name: b.exercise_name,
      rep_type: b.rep_type === "time" ? "time" : "reps",
      circuit_id: b.circuit_id || undefined,
      circuit_rounds: b.circuit_rounds || undefined,
      sets: (b.exerciseSets || []).map((st: any) => ({
        reps: st.reps || "",
        load: st.load || "",
        rpe: st.rpe ? String(st.rpe) : "",
        rir: st.rir != null ? String(st.rir) : "",
      })),
    })),
    strengthMaxes
  );

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {preview && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
            <span>
              <b>Aperçu</b> · la séance telle que {athleteFirstName} la voit. Touchez un exercice pour son détail.
            </span>
            <Link href={`/workouts/${workout.id}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
              Revenir à la vue coach
            </Link>
          </div>
        )}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate">
              {mtbLabel(parsePlan(workout.plan_json)?.discipline) ?? sportLabel(workout.sport)} ·{" "}
              {workout.flex_week && !workout.flex_placed
                ? `à placer dans la semaine du ${new Date(`${workout.flex_week}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                : new Date(`${workout.date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              {workout.time && isTimeOfDaySlug(workout.time)
                ? ` · ${formatWorkoutTime(workout.time)}`
                : workout.time
                  ? ` à ${workout.time}`
                  : ""}
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
              <StatusBadge status={workout.status} validated={!!workout.coach_validated_at} />
              {workout.is_draft ? (
                <span className="rounded-full bg-paper-dim px-2.5 py-0.5 text-xs font-semibold text-slate">Brouillon</span>
              ) : null}
            </div>
            {role === "coach" && (
              <div className="flex flex-wrap items-center gap-3">
                {workout.is_draft ? <PublishWorkoutButton workoutId={workout.id} /> : null}
                {/* Les autres actions sont regroupées dans le menu « ⋯ ». */}
                <MoreMenu label="Actions sur la séance">
                  <Link href={`/workouts/${workout.id}?apercu=athlete`} className={menuItem}>
                    Voir comme l&apos;athlète
                  </Link>
                  <Link href={`/workouts/${workout.id}/edit`} className={menuItem}>
                    Modifier la séance
                  </Link>
                  <OpenDetailsButton target="modifier-retour" className={menuItem}>
                    {workout.status === "planned" ? "Renseigner le retour" : "Modifier le retour"}
                  </OpenDetailsButton>
                  <CopyWorkoutButton workout={{ id: workout.id, title: workout.title, athleteName: athleteFirstName }} className={menuItem} />
                  <MoveWorkoutItem workoutId={workout.id} date={workout.date} />
                  <SendToAthletesButton
                    workoutId={workout.id}
                    workoutTitle={workout.title}
                    athleteId={workout.athlete_id}
                    athleteName={athleteFirstName}
                    date={workout.flex_week && !workout.flex_placed ? workout.flex_week : workout.date}
                    athletes={otherAthletes}
                    className={menuItem}
                  />
                  <MenuSeparator />
                  <CancelWorkoutButton workoutId={workout.id} className={`${menuItem} !text-[#a4492a]`} />
                </MoreMenu>
              </div>
            )}
            {role === "athlete" && !preview && (
              <MoreMenu label="Actions sur la séance">
                <a href="#renseigner" className={menuItem}>{workout.status === "planned" ? "Renseigner la séance" : "Modifier mon retour"}</a>
                <MoveWorkoutItem workoutId={workout.id} date={workout.date} />
              </MoreMenu>
            )}
            {role === "athlete" && (
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

        {(workout.duration_minutes || workout.planned_rpe) && (
          <div className="mb-6 flex flex-wrap gap-x-10 gap-y-3 rounded-3xl bg-white px-6 py-4">
            {workout.duration_minutes ? (
              <span className="text-sm text-slate">
                Durée prévue
                <b className="mt-0.5 block text-[22px] text-ink">
                  {workout.duration_minutes >= 60
                    ? `${Math.floor(workout.duration_minutes / 60)} h${workout.duration_minutes % 60 ? ` ${String(workout.duration_minutes % 60).padStart(2, "0")}` : ""}`
                    : `${workout.duration_minutes} min`}
                </b>
              </span>
            ) : null}
            {workout.planned_rpe ? (
              <span className="text-sm text-slate">
                Intensité visée
                <b className="mt-0.5 block text-[22px] text-ink">RPE {workout.planned_rpe}/10</b>
              </span>
            ) : null}
          </div>
        )}

        {!!workout.is_draft && role === "coach" && (
          <Card className="mb-6 border-dashed bg-paper-dim">
            <p className="text-sm text-ink-soft">
              Cette séance est un <b>brouillon</b> : votre athlète ne la voit pas et n&apos;a reçu aucune
              notification. Elle le sera dès que vous cliquerez sur « Publier ».
            </p>
          </Card>
        )}

        {workout.completion_photo_path && (
          <Card className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate"><span className="h-3 w-0.5 rounded-full bg-moss" />Photo de la séance</h2>
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
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate"><span className="h-3 w-0.5 rounded-full bg-moss" />Déroulé de la séance</h2>
            <WorkoutStructure json={workout.intervals_json} sport={workout.sport} />
          </Card>
        )}

        {workout.links_json && JSON.parse(workout.links_json).length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate"><span className="h-3 w-0.5 rounded-full bg-moss" />Liens utiles</h2>
            <ul className="flex flex-col gap-1.5">
              {(JSON.parse(workout.links_json) as { label: string; url: string }[]).map((l, i) => {
                const url = safeUrl(l.url);
                if (!url) return null;
                return (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:border-moss hover:bg-paper-dim/50"
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#e3eeed] text-moss-dark" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8.5 11.5a3.5 3.5 0 005 0l2.5-2.5a3.5 3.5 0 00-5-5l-1 1M11.5 8.5a3.5 3.5 0 00-5 0L4 11a3.5 3.5 0 005 5l1-1" /></svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm font-semibold text-ink">{l.label || shortUrl(url)}</b>
                        <span className="block truncate text-xs text-slate">{shortUrl(url)}</span>
                      </span>
                      <span className="text-slate" aria-hidden>↗</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {workout.description && (
          <Card className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate"><span className="h-3 w-0.5 rounded-full bg-moss" />Consignes du coach</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink"><Linkify text={workout.description} /></p>
          </Card>
        )}

        {blocks.length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate"><span className="h-3 w-0.5 rounded-full bg-moss" />Déroulé de la séance</h2>

            {/* Récapitulatif réservé au coach : c'est un outil de dosage de la
                charge, pas une information dont l'athlète a besoin pour
                exécuter sa séance. */}
            {role === "coach" && strengthVolume.exerciseCount > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-paper-dim p-3 sm:grid-cols-4">
                <div>
                  <p className="text-base font-semibold text-ink">{strengthVolume.totalSets}</p>
                  <p className="text-[11px] text-slate">séries</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">{strengthVolume.totalReps || "—"}</p>
                  <p className="text-[11px] text-slate">répétitions</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">
                    {strengthVolume.totalLoadKg ? `${strengthVolume.totalLoadKg.toLocaleString("fr-FR")} kg` : "—"}
                  </p>
                  <p className="text-[11px] text-slate">tonnage</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">{formatSeconds(strengthVolume.totalTimeSeconds)}</p>
                  <p className="text-[11px] text-slate">travail minuté</p>
                </div>
              </div>
            )}

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

                // Contexte de série de chaque exercice (lettre, tours, récup, exercices enchaînés).
                const seriesOf = new Map<string, ExerciseDetailData["series"]>();
                let letter = 0;
                for (const seg of segments) {
                  if (!seg.circuitId) continue;
                  const L = String.fromCharCode(65 + letter++);
                  for (const b of seg.blocks)
                    seriesOf.set(b.id, {
                      label: `Série ${L}`,
                      rounds: seg.rounds || 1,
                      restSeconds: seg.blocks[0]?.circuit_rest_seconds || null,
                      others: seg.blocks.filter((o: any) => o.id !== b.id).map((o: any) => o.exercise_name),
                    });
                }
                const detailOf = (b: any): ExerciseDetailData => {
                  const maxKg = strengthMaxes[b.exercise_name] ? Math.round(strengthMaxes[b.exercise_name] * 10) / 10 : null;
                  const anim = b.resource_id ? null : animationFor(b.exercise_name);
                  return {
                    name: b.exercise_name,
                    blockTitle: blockTitle(b),
                    partColor: partColors(b.block_type).color,
                    qualityLabel: b.training_quality ? QUALITY_LABELS[b.training_quality] : null,
                    qualityTip: b.training_quality ? QUALITY_TIPS[b.training_quality] ?? null : null,
                    repType: b.rep_type === "time" ? "time" : "reps",
                    tempo: b.tempo ? { raw: b.tempo, phases: tempoPhases(b.tempo) } : null,
                    coachNotes: b.notes || null,
                    series: seriesOf.get(b.id) ?? null,
                    maxKg: (b.exerciseSets || []).some((st: any) => st.load && loadInKg(st.load, maxKg)) ? maxKg : null,
                    sets: (b.exerciseSets || []).map((st: any) => ({
                      n: st.set_number,
                      reps: st.reps || null,
                      load: st.load || null,
                      loadKg: st.load ? loadInKg(st.load, maxKg) : null,
                      rest: st.rest_seconds || null,
                      rpe: st.rpe || null,
                      rir: st.rir ?? null,
                    })),
                    demo: b.resource_id
                      ? {
                          kind: b.resource_type === "video" ? "video" : "image",
                          url: resourceFileUrl({ id: b.resource_id, file_path: b.resource_file_path, title: b.resource_title, description: b.resource_description }),
                          mime: b.resource_mime_type || undefined,
                          title: b.resource_title || b.exercise_name,
                          caption: b.resource_description || null,
                          builtIn: false,
                        }
                      : anim
                        ? { kind: "image", url: anim.url, title: anim.title, caption: anim.description, builtIn: true }
                        : null,
                  };
                };

                // La démonstration (GIF, vidéo) ne s'affiche plus dans la liste :
                // elle s'ouvre en touchant l'exercice, dans sa fiche détaillée.
                const renderBlock = (b: any) => {
                  const detail = detailOf(b);
                  const pc = partColors(b.block_type);
                  return (
                  <div key={b.id} className="border-l-[3px] pl-3" style={{ borderColor: pc.color }}>
                  <ExerciseDetailButton data={detail}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: pc.color }}>{blockTitle(b)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink underline decoration-moss/40 decoration-dotted underline-offset-4">{b.exercise_name}</p>
                      {detail.demo && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-2 py-0.5 text-[10px] font-semibold text-moss-dark">
                          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
                          Voir le mouvement
                        </span>
                      )}
                      {b.training_quality && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${QUALITY_STYLES[b.training_quality]}`}>
                          {QUALITY_LABELS[b.training_quality]}
                        </span>
                      )}
                    </div>
                    {b.tempo && (
                      <p className="mt-0.5 text-[13px] text-ink-soft">
                        <b className="font-semibold text-ink">Tempo {b.tempo}</b>
                        <span className="text-slate"> · descente – pause – montée – pause (s)</span>
                      </p>
                    )}
                    {b.exerciseSets?.length > 0 && (
                      /* En-têtes explicites : sans eux, « 10 » et « 60 » se
                         ressemblent et rien ne dit lequel est la charge. */
                      <div className="mt-2 overflow-hidden rounded-xl border border-line">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-paper-dim text-[10px] uppercase tracking-wider text-slate">
                              <th className="px-2 py-1 text-left font-semibold">Série</th>
                              <th className="px-2 py-1 text-left font-semibold">
                                {b.rep_type === "time" ? "Durée" : "Répétitions"}
                              </th>
                              <th className="px-2 py-1 text-left font-semibold">Charge</th>
                              <th className="px-2 py-1 text-left font-semibold">Repos</th>
                              <th className="px-2 py-1 text-left font-semibold">RPE</th>
                              <th className="px-2 py-1 text-left font-semibold">RIR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.exerciseSets.map((s: any) => (
                              <tr key={s.id} className="border-t border-line">
                                <td className="px-2 py-1.5 font-medium text-ink-soft">{s.set_number}</td>
                                <td className="px-2 py-1.5 font-semibold text-ink">
                                  {b.rep_type === "time" ? "⏱ " : ""}
                                  {s.reps || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-ink">{s.load || "—"}</td>
                                <td className="px-2 py-1.5 text-slate">{s.rest_seconds ? `${s.rest_seconds} s` : "—"}</td>
                                <td className="px-2 py-1.5 text-slate">{s.rpe || "—"}</td>
                                <td className="px-2 py-1.5 text-slate">{s.rir ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {b.notes && <p className="whitespace-pre-line text-sm text-ink-soft"><Linkify text={b.notes} /></p>}
                  </ExerciseDetailButton>
                  </div>
                  );
                };

                // Chaque partie (échauffement, corps de séance, gainage, retour
                // au calme) a sa couleur, avec un intitulé quand elle commence.
                let prevPart: string | null = null;
                return segments.map((segment, i) => {
                  const part = partOf(segment.blocks[0]?.block_type ?? "main");
                  const pc = PART_COLORS[part];
                  const header =
                    part !== prevPart ? (
                      <div className={`flex items-center gap-2 ${i > 0 ? "mt-3" : ""}`}>
                        <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: pc.bg, color: pc.color }}>
                          {part}
                        </span>
                        <span className="h-px flex-1" style={{ background: pc.line }} />
                      </div>
                    ) : null;
                  prevPart = part;
                  if (!segment.circuitId)
                    return (
                      <div key={`s${i}`} className="flex flex-col gap-3">
                        {header}
                        {segment.blocks.map(renderBlock)}
                      </div>
                    );
                  return (
                    <div key={segment.circuitId} className="flex flex-col gap-3">
                    {header}
                    <div className="rounded-xl border-2 border-dashed p-3" style={{ borderColor: pc.line, background: `${pc.bg}80` }}>
                      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color: pc.color }}>
                        <span>Série × {segment.rounds || 1}</span>
                        {segment.blocks[0]?.circuit_rest_seconds ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                            récup. {segment.blocks[0].circuit_rest_seconds}s entre séries
                          </span>
                        ) : null}
                        {segment.blocks.length > 1 && (
                          <span className="text-[11px] font-normal text-ink-soft">
                            {segment.blocks.length} exercices enchaînés
                          </span>
                        )}
                      </p>
                      <div className="flex flex-col gap-3">{segment.blocks.map(renderBlock)}</div>
                    </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>
        )}

        {(workout.status !== "planned" || workout.rpe) && (
          <Card className="mb-6">
            <h2 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-ink-soft">
              Retour de l&apos;athlète
              {workout.reported_by === "coach" && (
                <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[10px] font-semibold text-slate">
                  saisi par le coach
                </span>
              )}
            </h2>
            <p className="text-sm text-ink">
              {workout.rpe ? `RPE ${workout.rpe}/10` : "Pas de RPE renseigné"}
              {workout.actual_duration_minutes ? ` · ${formatDuration(workout.actual_duration_minutes)} ${workout.elapsed_minutes ? "effectif" : "réelles"}` : ""}
              {workout.elapsed_minutes ? ` · ${formatDuration(workout.elapsed_minutes)} au total` : ""}
              {workout.distance_km ? ` · ${workout.distance_km} km` : ""}
              {workout.avg_hr ? ` · FC moy. ${workout.avg_hr}` : ""}
              {workout.elevation_gain_m ? ` · D+ ${workout.elevation_gain_m} m` : ""}
              {workout.avg_power_w ? ` · ${workout.avg_power_w} W moy.` : ""}
            </p>
            {workout.route_url && safeUrl(workout.route_url) && (
              <a href={safeUrl(workout.route_url)!} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-moss-dark underline decoration-moss/40 underline-offset-2">
                Parcours · {shortUrl(workout.route_url)}
              </a>
            )}
            {workout.athlete_feedback && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft"><Linkify text={workout.athlete_feedback} /></p>}
          </Card>
        )}

        {role === "athlete" && (
          <div id="renseigner" className="scroll-mt-4">
            <Card className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate"><span className="h-3 w-0.5 rounded-full bg-moss" />Où en êtes-vous ?</h2>
              {preview ? (
                <>
                  <p className="mb-3 text-xs text-slate">Aperçu : {athleteFirstName} renseigne ici sa séance. Désactivé dans l&apos;aperçu.</p>
                  <div inert className="pointer-events-none select-none opacity-60">
                    <StatusForm workoutId={workout.id} currentStatus={workout.status} sport={workout.sport} discipline={workoutDiscipline} initial={statusInitial} />
                  </div>
                </>
              ) : (
                <StatusForm workoutId={workout.id} currentStatus={workout.status} sport={workout.sport} discipline={workoutDiscipline} initial={statusInitial} />
              )}
            </Card>
          </div>
        )}

        {/* Le coach saisit le réalisé quand l'athlète le lui a transmis hors
            application — par message, par téléphone, ou de vive voix à
            l'entraînement. Replié par défaut : c'est le cas particulier, pas
            la marche normale, et la saisie de l'athlète reste la référence. */}
        {role === "coach" && (
          <Card className="mb-6">
            <details id="modifier-retour" className="scroll-mt-24">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-slate">
                {workout.status === "planned" ? <>Renseigner la séance à la place de l&apos;athlète</> : "Modifier le retour de la séance"}
              </summary>
              <p className="mb-3 mt-2 text-xs text-slate">
                À utiliser si l&apos;athlète vous a transmis son retour en dehors de l&apos;application. La saisie sera
                signalée comme venant de vous.
              </p>
              <StatusForm workoutId={workout.id} currentStatus={workout.status} sport={workout.sport} discipline={workoutDiscipline} initial={statusInitial} asCoach />
            </details>
          </Card>
        )}

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate"><span className="h-3 w-0.5 rounded-full bg-moss" />Échanges</h2>
          <div className="mb-4 flex flex-col gap-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md bg-paper-dim p-2 text-sm">
                <CommentBody id={c.id} body={c.body} mine={!preview && c.author_id === user.id} />
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
          {!preview && <CommentForm workoutId={workout.id} />}
        </Card>
      </main>
    </div>
  );
}
