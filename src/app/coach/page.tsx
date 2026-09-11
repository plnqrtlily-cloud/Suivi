import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAthletesForCoach } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { InviteForm } from "./invite-form";
import { RevokeButton } from "./revoke-button";

export default async function CoachDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const links = await getAthletesForCoach(user.id);
  const active = links.filter((l) => l.status === "active");
  const pending = links.filter((l) => l.status === "pending");

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Mes athlètes</h1>
        <p className="mb-8 text-slate">
          {active.length} athlète{active.length === 1 ? "" : "s"} suivi{active.length === 1 ? "" : "s"}
        </p>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Inviter un athlète</h2>
          <InviteForm />
        </Card>

        <div className="grid gap-3">
          {active.map((link) => (
            <Link key={link.link_id} href={`/coach/athletes/${link.athlete_id}`}>
              <Card className="flex items-center justify-between rounded-2xl transition-colors hover:border-moss">
                <div className="flex items-center gap-3">
                  <Avatar userId={link.athlete_id!} firstName={link.first_name || "?"} hasAvatar={!!link.avatar_path} />
                  <div>
                    <p className="font-medium text-ink">
                      {link.first_name} {link.last_name}
                    </p>
                    <p className="text-sm text-slate">{link.email}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-moss-dark">Voir le suivi →</span>
              </Card>
            </Link>
          ))}

          {pending.map((link) => (
            <Card key={link.link_id} className="flex items-center justify-between rounded-2xl bg-paper-dim">
              <div>
                <p className="font-medium text-ink-soft">Invitation en attente</p>
                <p className="text-sm text-slate">{link.invite_email || "Lien partagé sans email précisé"}</p>
              </div>
              <RevokeButton linkId={link.link_id} label="Annuler" />
            </Card>
          ))}

          {active.length === 0 && pending.length === 0 && (
            <Card className="rounded-2xl text-center text-slate">
              Aucun athlète pour l&apos;instant — générez un lien d&apos;invitation ci-dessus.
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
