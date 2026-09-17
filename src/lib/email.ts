// Envoi d'email transactionnel. Volontairement minimal : un seul appel HTTP
// vers Resend, sans dépendance supplémentaire à installer.
//
// Tant que RESEND_API_KEY n'est pas configuré, isEmailConfigured() renvoie
// false et l'appelant doit refuser l'opération plutôt que de contourner
// l'envoi — c'est ce qui empêche un lien de réinitialisation de repartir dans
// la réponse HTTP, où n'importe qui pourrait le lire.

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        text: params.text,
      }),
    });
    if (!response.ok) {
      // Le détail de l'erreur reste dans les journaux serveur : le renvoyer au
      // client indiquerait si l'adresse existe.
      console.error("Échec d'envoi d'email :", response.status, await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Échec d'envoi d'email :", err);
    return false;
  }
}

// URL publique de l'application, pour construire des liens absolus dans les
// emails. Vercel fournit VERCEL_PROJECT_PRODUCTION_URL automatiquement.
export function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
