import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-3xl text-ink">Mot de passe oublié</h1>
        <p className="mb-8 text-slate">
          Le lien de réinitialisation expire au bout d&apos;une heure et ne peut être utilisé qu&apos;une seule fois.
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 text-sm text-slate">
          <Link href="/login" className="text-moss-dark underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
