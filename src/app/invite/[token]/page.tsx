import { redirect } from "next/navigation";
import { dbGet } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { linkAthleteWithCode } from "@/lib/linking";
import { Button, Card } from "@/components/ui";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();

  const invite = await dbGet<any>(
    `SELECT l.*, u.first_name, u.last_name FROM coach_athlete_links l
     JOIN users u ON u.id = l.coach_id
     WHERE l.invite_token = ?`,
    [token]
  );

  if (!invite || invite.status !== "pending") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6">
        <Card className="max-w-sm text-center">
          <p className="text-ink">Ce lien d&apos;invitation n&apos;est plus valide.</p>
        </Card>
      </main>
    );
  }

  // Pas connecté : on ne sait pas encore si l'athlète a un compte, on lui
  // laisse le choix (créer un compte ou se connecter), l'invitation suit.
  if (!user) {
    const known = invite.invite_email
      ? await dbGet<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [String(invite.invite_email).toLowerCase()])
      : undefined;
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6">
        <Card className="flex w-full max-w-sm flex-col gap-4 text-center">
          <p className="text-ink">
            <strong>
              {invite.first_name} {invite.last_name}
            </strong>{" "}
            vous invite à rejoindre son suivi d&apos;entraînement sur Rythme.
          </p>
          <Link
            href={known ? `/login?invite=${token}` : `/register?invite=${token}`}
            className="rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-dark"
          >
            {known ? "Me connecter et accepter" : "Créer mon compte athlète"}
          </Link>
          <Link
            href={known ? `/register?invite=${token}` : `/login?invite=${token}`}
            className="text-sm font-semibold text-moss-dark hover:underline"
          >
            {known ? "Créer un autre compte" : "J'ai déjà un compte"}
          </Link>
        </Card>
      </main>
    );
  }

  if (user!.role !== "athlete") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6">
        <Card className="max-w-sm text-center">
          <p className="mb-2 text-ink">Cette invitation est destinée à un compte athlète.</p>
          <p className="text-sm text-slate">
            Vous êtes actuellement connecté·e avec un compte coach dans ce navigateur. Ouvrez ce
            lien dans une fenêtre de navigation privée, ou déconnectez-vous puis créez/connectez-vous
            à un compte athlète pour l&apos;accepter.
          </p>
        </Card>
      </main>
    );
  }

  async function accept() {
    "use server";
    const res = await linkAthleteWithCode(user!.id, token);
    redirect("error" in res ? `/settings?lien=${encodeURIComponent(res.error)}#coachs` : "/athlete");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <Card className="max-w-sm text-center">
        <p className="mb-4 text-ink">
          <strong>
            {invite.first_name} {invite.last_name}
          </strong>{" "}
          vous invite à rejoindre son suivi d&apos;entraînement.
        </p>
        <form action={accept}>
          <Button type="submit">Accepter l&apos;invitation</Button>
        </form>
      </Card>
    </main>
  );
}
