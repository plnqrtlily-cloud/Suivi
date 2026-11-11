import Link from "next/link";
import { dbGet } from "@/lib/db";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const inv = invite
    ? await dbGet<{ first_name: string; last_name: string }>(
        `SELECT u.first_name, u.last_name FROM coach_athlete_links l JOIN users u ON u.id = l.coach_id
         WHERE l.invite_token = ? AND l.status = 'pending'`,
        [invite]
      )
    : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-4xl text-ink">Rythme</h1>
        <p className="mb-8 text-slate">
          {inv
            ? `${inv.first_name} ${inv.last_name} vous invite à rejoindre son suivi. Connectez-vous à votre compte athlète pour accepter.`
            : "Planification et suivi entre coach et athlète."}
        </p>
        <LoginForm inviteToken={inv ? invite : undefined} />
        <p className="mt-4 text-sm text-slate">
          <Link href="/forgot-password" className="text-moss-dark underline">
            Mot de passe oublié ?
          </Link>
        </p>
        <p className="mt-2 text-sm text-slate">
          Pas encore de compte ?{" "}
          <Link href={inv ? `/register?invite=${invite}` : "/register"} className="text-moss-dark underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
