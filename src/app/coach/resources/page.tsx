import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getResourcesForCoach } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card } from "@/components/ui";
import { UploadResourceForm } from "./upload-form";
import { ResourceLibrary } from "./resource-library";
import { upgradeOutdatedAnimations } from "@/lib/animation-upgrade";
import { ImportAnimationsCard } from "./import-animations";
import { EXERCISE_ANIMATIONS, outdatedAnimations } from "@/lib/exercise-animations";

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { type } = await searchParams;
  await upgradeOutdatedAnimations(user.id);
  const resources = await getResourcesForCoach(user.id, type);
  const allResources = type ? await getResourcesForCoach(user.id) : resources;
  const existingTitles = new Set(allResources.map((r) => r.title));
  const missingAnimations = EXERCISE_ANIMATIONS.filter((a) => !existingTitles.has(a.title)).length;
  const outdated = outdatedAnimations(allResources).length;

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/resources" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Ma bibliothèque</h1>
        <p className="mb-8 text-slate">Vidéos, photos et matériel que vous déposez vous-même — visibles par vos athlètes liés.</p>

        {missingAnimations + outdated > 0 && <ImportAnimationsCard missing={missingAnimations} outdated={outdated} total={EXERCISE_ANIMATIONS.length} />}

        <Card className="mb-8 rounded-3xl">
          <UploadResourceForm />
        </Card>

        <div className="mb-4 flex gap-2 text-sm">
          {[
            { value: "", label: "Tout" },
            { value: "video", label: "Vidéos" },
            { value: "photo", label: "Photos" },
            { value: "equipment", label: "Matériel" },
          ].map((f) => (
            <a
              key={f.value}
              href={f.value ? `/coach/resources?type=${f.value}` : "/coach/resources"}
              className={`rounded-full border px-3 py-1 ${
                (type || "") === f.value ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-slate"
              }`}
            >
              {f.label}
            </a>
          ))}
        </div>

        {resources.length === 0 ? (
          <p className="text-sm text-slate">Rien pour l&apos;instant — ajoutez votre première ressource ci-dessus.</p>
        ) : (
          <ResourceLibrary resources={resources} />
        )}
      </main>
      </div>
    </div>
  );
}
