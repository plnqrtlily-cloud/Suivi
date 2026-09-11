import Link from "next/link";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-4xl text-ink">Créer un compte</h1>
        <p className="mb-8 text-slate">
          {invite
            ? "Votre coach vous a invité·e — créez votre compte athlète pour rejoindre son suivi."
            : "Coach ou athlète, l'inscription se fait sur la même page."}
        </p>
        <RegisterForm defaultInviteToken={invite} />
        <p className="mt-6 text-sm text-slate">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-moss-dark underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
