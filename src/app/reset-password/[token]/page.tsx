import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-3xl text-ink">Nouveau mot de passe</h1>
        <p className="mb-8 text-slate">Choisissez un nouveau mot de passe pour votre compte.</p>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
