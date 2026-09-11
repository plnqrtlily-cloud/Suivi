import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getResourcesForCoach } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { UploadResourceForm } from "./upload-form";
import { ResourceCard } from "./resource-card";

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { type } = await searchParams;
  const resources = await getResourcesForCoach(user.id, type);

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Ma bibliothèque</h1>
        <p className="mb-8 text-slate">Vidéos, photos et matériel que vous déposez vous-même — visibles par vos athlètes liés.</p>

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
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
