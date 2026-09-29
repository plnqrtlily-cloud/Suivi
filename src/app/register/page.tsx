import Link from "next/link";
import { RegisterForm } from "./register-form";
import { dbGet } from "@/lib/db";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  // Invitation personnalisée : prénom et e-mail pré-remplis, nom du coach
  // affiché pour que l'athlète sache qui l'invite.
  const inv = invite
    ? await dbGet<{ invite_email: string | null; invite_first_name: string | null; first_name: string; last_name: string; status: string }>(
        `SELECT l.invite_email, l.invite_first_name, l.status, u.first_name, u.last_name
         FROM coach_athlete_links l JOIN users u ON u.id = l.coach_id WHERE l.invite_token = ?`,
        [invite]
      )
    : undefined;
  const validInvite = inv && inv.status === "pending" ? inv : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-4xl text-ink">Créer un compte</h1>
        <p className="mb-8 text-slate">
          {validInvite
            ? `${validInvite.first_name} ${validInvite.last_name} vous invite à rejoindre son suivi. Créez votre compte athlète.`
            : invite
            ? "Votre coach vous a invité·e — créez votre compte athlète pour rejoindre son suivi."
            : "Coach ou athlète, l'inscription se fait sur la même page."}
        </p>
        <RegisterForm
          defaultInviteToken={invite}
          defaultFirstName={validInvite?.invite_first_name ?? undefined}
          defaultEmail={validInvite?.invite_email ?? undefined}
        />
        <p className="mt-6 text-sm text-slate">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-moss-dark underline">
            Se connecter
          </Link>
        </p>
        {!invite && (
          <p className="mt-2 text-sm text-slate">
            <Link href="/tarifs" className="text-moss-dark underline">
              Voir les tarifs
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
