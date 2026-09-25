// Intégration Stripe minimale, en HTTP direct plutôt qu'avec le SDK officiel
// — même choix que src/lib/email.ts (Resend) : un seul appel fetch, pas de
// dépendance supplémentaire à installer pour deux endpoints.
//
// Tant que STRIPE_SECRET_KEY/STRIPE_PRICE_ID_PRO ne sont pas configurés,
// isStripeConfigured() renvoie false et l'appelant doit se rabattre sur le
// contact par email (cf. upgradeMailtoHref dans billing.ts) plutôt que
// d'échouer silencieusement — même principe que isEmailConfigured().
import { createHmac, timingSafeEqual } from "crypto";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_PRO);
}

async function stripeRequest(path: string, params: Record<string, string>): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = await response.json();
  if (!response.ok) {
    console.error("Erreur Stripe :", response.status, json);
    throw new Error(json?.error?.message || "Erreur Stripe.");
  }
  return json;
}

// Abonnement mensuel unique (le plan Pro) : pas de sélection de quantité ou
// de plusieurs offres, une session de paiement suffit. client_reference_id +
// metadata portent l'id du coach pour que le webhook sache qui faire passer
// Pro (cf. checkout.session.completed dans src/app/api/stripe/webhook/route.ts).
export async function createCheckoutSession(params: {
  coachId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | { error: string }> {
  try {
    const session = await stripeRequest("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": process.env.STRIPE_PRICE_ID_PRO!,
      "line_items[0][quantity]": "1",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.coachId,
      customer_email: params.email,
      "metadata[coach_id]": params.coachId,
      "subscription_data[metadata][coach_id]": params.coachId,
      allow_promotion_codes: "true",
    });
    if (!session.url) return { error: "Stripe n'a pas renvoyé de lien de paiement." };
    return { url: session.url as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur Stripe." };
  }
}

// Portail client Stripe : self-service pour qu'un coach déjà Pro mette à jour
// son moyen de paiement ou résilie sans avoir à écrire un email — sans ça,
// toute résiliation resterait une bascule manuelle côté admin comme
// aujourd'hui pour l'activation.
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string } | { error: string }> {
  try {
    const session = await stripeRequest("billing_portal/sessions", {
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    if (!session.url) return { error: "Stripe n'a pas renvoyé de lien vers le portail client." };
    return { url: session.url as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur Stripe." };
  }
}

// Vérifie qu'un événement webhook vient bien de Stripe (en-tête
// Stripe-Signature : "t=<timestamp>,v1=<signature>[,v0=...]") avant d'agir
// dessus — sans ça, n'importe qui connaissant l'URL du webhook pourrait
// s'auto-attribuer le plan Pro. La comparaison passe par timingSafeEqual pour
// ne pas laisser fuiter la signature attendue via le temps de réponse.
export function verifyStripeSignature(payload: string, sigHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
