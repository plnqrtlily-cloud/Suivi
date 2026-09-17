import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getResourcesForCoach,
  getCoachExerciseHistory,
  getLatestExerciseMaxes,
  getWorkoutTemplatesForCoach,
  getAthletesForCoach,
} from "@/lib/queries";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";
import { WorkoutForm, type WorkoutTemplateOption } from "../athletes/[athleteId]/new-workout/workout-form";
import { TemplateList } from "../athletes/[athleteId]/new-workout/template-list";

// Création de séance accessible directement depuis la navigation, sans passer
// par la fiche d'un athlète : le coach choisit d'abord à qui la séance est
// destinée, puis la construit. La séance part dans le calendrier de l'athlète
// — ou reste en brouillon tant qu'il ne la publie pas.
export default async function NouvelleSeancePage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athlete: athleteParam } = await searchParams;
  const links = await getAthletesForCoach(user.id);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);
  const selected = activeAthletes.find((a) => a.athlete_id === athleteParam);

  // Tant qu'aucun athlète n'est choisi, on ne montre que la sélection : le
  // formulaire dépend de ses charges de référence et de son historique.
  if (!selected) {
    return (
      <div className="flex min-h-screen bg-paper">
        <CoachSidebar user={user} activeHref="/coach/nouvelle-seance" />
        <div className="min-w-0 flex-1">
          <div className="lg:hidden">
            <Nav user={user} />
          </div>
          <main className="mx-auto max-w-3xl px-6 py-8">
            <h1 className="mb-1 font-display text-3xl text-ink">Créer une séance</h1>
            <p className="mb-6 text-slate">Pour qui construisez-vous cette séance ?</p>

            {activeAthletes.length === 0 ? (
              <Card className="rounded-3xl">
                <p className="text-slate">
                  Aucun athlète actif —{" "}
                  <Link href="/coach/dashboard" className="font-medium text-moss-dark hover:underline">
                    invitez-en un d&apos;abord
                  </Link>
                  .
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeAthletes.map((a) => (
                  <Link
                    key={a.link_id}
                    href={`/coach/nouvelle-seance?athlete=${a.athlete_id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:border-moss"
                  >
                    <Avatar userId={a.athlete_id!} firstName={a.first_name || "?"} hasAvatar={!!a.avatar_path} size="lg" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {a.first_name} {a.last_name}
                      </span>
                      <span className="text-xs text-slate">Créer une séance</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  const athleteId = selected.athlete_id as string;
  const [rawResources, exerciseHistory, exerciseMaxes, rawTemplates] = await Promise.all([
    getResourcesForCoach(user.id),
    getCoachExerciseHistory(user.id),
    getLatestExerciseMaxes(athleteId),
    getWorkoutTemplatesForCoach(user.id),
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
  const otherAthletes = activeAthletes
    .filter((a) => a.athlete_id !== athleteId)
    .map((a) => ({ id: a.athlete_id as string, name: `${a.first_name} ${a.last_name}` }));

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/nouvelle-seance" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="mb-1 font-display text-3xl text-ink">Créer une séance</h1>
          <p className="mb-6 flex flex-wrap items-center gap-2 text-slate">
            Pour {selected.first_name} {selected.last_name}
            <Link href="/coach/nouvelle-seance" className="text-sm font-semibold text-moss-dark hover:underline">
              changer d&apos;athlète
            </Link>
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
