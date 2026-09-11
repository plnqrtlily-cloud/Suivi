import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-4xl text-ink">Rythme</h1>
        <p className="mb-8 text-slate">Planification et suivi entre coach et athlète.</p>
        <LoginForm />
        <p className="mt-4 text-sm text-slate">
          <Link href="/forgot-password" className="text-moss-dark underline">
            Mot de passe oublié ?
          </Link>
        </p>
        <p className="mt-2 text-sm text-slate">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-moss-dark underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
