// Intégration Stripe minimale, en HTTP direct plutôt qu'avec le SDK officiel
// — même choix que src/lib/email.ts (Resend) : un seul appel fetch, pas de
// dépendance supplémentaire à installer pour deux endpoints.
//
// Seule STRIPE_SECRET_KEY est nécessaire : le produit « Rythme Pro », ses deux
// prix, le webhook et le portail client sont créés par l'application via
// l'API au premier besoin (ensureStripeSetup), plutôt que configurés à la main
// dans le Dashboard. Sans la clé, isStripeConfigured() renvoie false et
// l'appelant se rabat sur le contact par email (cf. upgradeMailtoHref).
import { createHmac, timingSafeEqual } from "crypto";
import { PRO_PLAN_PRICE_EUR, PRO_PLAN_PRICE_YEAR_EUR } from "./billing";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
export function isYearlyConfigured(): boolean {
  return isStripeConfigured();
}

const PRODUCT_ID = "rythme_pro";
const LOOKUP = { month: "rythme_pro_month", year: "rythme_pro_year" } as const;
export const WEBHOOK_EVENTS = ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function stripeCall(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<{ ok: boolean; status: number; json: Json }> {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && qs ? `?${qs}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${String(process.env.STRIPE_SECRET_KEY).trim()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? qs : undefined,
    cache: "no-store",
  });
  return { ok: response.ok, status: response.status, json: await response.json() };
}

async function stripeRequest(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<Json> {
  const { ok, status, json } = await stripeCall(method, path, params);
  if (!ok) {
    console.error("Erreur Stripe :", status, json?.error?.message);
    throw new Error(json?.error?.message || "Erreur Stripe.");
  }
  return json;
}

/** Produit « Rythme Pro » (identifiant fixe) et ses prix mensuel/annuel, créés s'ils manquent. */
async function ensurePrices(): Promise<{ month: string; year: string }> {
  const found = await stripeRequest("prices", { "lookup_keys[0]": LOOKUP.month, "lookup_keys[1]": LOOKUP.year, active: "true" }, "GET");
  const byKey = new Map<string, string>((found.data as Json[]).map((p) => [p.lookup_key, p.id]));
  if (byKey.size < 2) {
    const product = await stripeCall("GET", `products/${PRODUCT_ID}`);
    if (!product.ok) {
      await stripeRequest("products", { id: PRODUCT_ID, name: "Rythme Pro", description: "Suivi coach-athlète, athlètes illimités." });
    }
    for (const interval of ["month", "year"] as const) {
      if (byKey.has(LOOKUP[interval])) continue;
      const price = await stripeRequest("prices", {
        product: PRODUCT_ID,
        currency: "eur",
        unit_amount: String((interval === "month" ? PRO_PLAN_PRICE_EUR : PRO_PLAN_PRICE_YEAR_EUR) * 100),
        "recurring[interval]": interval,
        lookup_key: LOOKUP[interval],
        nickname: interval === "month" ? "Mensuel" : "Annuel",
      });
      byKey.set(LOOKUP[interval], price.id);
    }
  }
  return { month: byKey.get(LOOKUP.month)!, year: byKey.get(LOOKUP.year)! };
}

/** Webhook vers l'application, créé s'il n'existe pas déjà pour cette adresse. */
async function ensureWebhook(baseUrl: string): Promise<string> {
  const url = `${baseUrl}/api/stripe/webhook`;
  const list = await stripeRequest("webhook_endpoints", { limit: "100" }, "GET");
  const existing = (list.data as Json[]).find((w) => w.url === url);
  if (existing) return existing.id;
  const params: Record<string, string> = { url, description: "Rythme : activation et résiliation du plan Pro" };
  WEBHOOK_EVENTS.forEach((e, i) => (params[`enabled_events[${i}]`] = e));
  return (await stripeRequest("webhook_endpoints", params)).id;
}

/** Portail client (carte, factures, changement de formule, résiliation) par défaut. */
async function ensurePortal(baseUrl: string, prices: { month: string; year: string }): Promise<string> {
  const list = await stripeRequest("billing_portal/configurations", { is_default: "true", limit: "1" }, "GET");
  if (list.data?.length) return list.data[0].id;
  return (
    await stripeRequest("billing_portal/configurations", {
      "business_profile[headline]": "Rythme — gérer mon abonnement",
      default_return_url: `${baseUrl}/settings#abonnement`,
      "features[invoice_history][enabled]": "true",
      "features[payment_method_update][enabled]": "true",
      "features[customer_update][enabled]": "true",
      "features[customer_update][allowed_updates][0]": "email",
      "features[customer_update][allowed_updates][1]": "address",
      "features[subscription_cancel][enabled]": "true",
      "features[subscription_cancel][mode]": "at_period_end",
      "features[subscription_update][enabled]": "true",
      "features[subscription_update][default_allowed_updates][0]": "price",
      "features[subscription_update][proration_behavior]": "create_prorations",
      "features[subscription_update][products][0][product]": PRODUCT_ID,
      "features[subscription_update][products][0][prices][0]": prices.month,
      "features[subscription_update][products][0][prices][1]": prices.year,
    })
  ).id;
}

export interface StripeSetup {
  prices: { month: string; year: string };
  webhookId: string;
  portalId: string;
  livemode: boolean;
}

// Mémorisé par instance : les vérifications ne coûtent que quelques appels
// au premier paiement après un démarrage à froid.
let setupPromise: Promise<StripeSetup> | null = null;

/** Crée (une seule fois) tout ce dont l'abonnement a besoin côté Stripe. */
export function ensureStripeSetup(baseUrl: string): Promise<StripeSetup> {
  if (!setupPromise) {
    setupPromise = (async () => {
      // Clé copiée depuis l'aperçu masqué du Dashboard (« sk_live_… ») au lieu
      // de la clé révélée en entier : message clair plutôt qu'une erreur HTTP.
      if (!/^(sk|rk)_(live|test)_[A-Za-z0-9]{20,}$/.test(String(process.env.STRIPE_SECRET_KEY).trim())) {
        // Diagnostic sans exposer la clé : préfixe (sk_/pk_…), longueur, points de suspension.
        const k = String(process.env.STRIPE_SECRET_KEY).trim();
        const hint = k.startsWith("pk_")
          ? "c'est la clé publique (pk_…) : il faut la clé secrète (sk_live_…)."
          : k.includes("…") || k.includes("...")
            ? "c'est l'aperçu abrégé (avec « … ») : il faut la clé entière."
            : `format inattendu (début « ${k.slice(0, 8)} », ${k.length} caractères).`;
        throw new Error(`STRIPE_SECRET_KEY invalide — ${hint}`);
      }
      const prices = await ensurePrices();
      const [webhookId, portalId] = await Promise.all([ensureWebhook(baseUrl), ensurePortal(baseUrl, prices)]);
      return { prices, webhookId, portalId, livemode: !String(process.env.STRIPE_SECRET_KEY).includes("_test_") };
    })().catch((err) => {
      setupPromise = null;
      throw err;
    });
  }
  return setupPromise;
}

/**
 * Événement webhook authentifié. Avec STRIPE_WEBHOOK_SECRET, on vérifie la
 * signature ; sinon on relit l'événement auprès de l'API Stripe avec la clé
 * secrète — un faux événement envoyé à l'URL n'y existe pas.
 */
export async function authenticStripeEvent(payload: string, signature: string | null): Promise<Json | null> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret) return signature && verifyStripeSignature(payload, signature, secret) ? JSON.parse(payload) : null;
  let id: string | undefined;
  try {
    id = JSON.parse(payload)?.id;
  } catch {
    return null;
  }
  if (!id || !/^evt_[A-Za-z0-9]+$/.test(id)) return null;
  const res = await stripeCall("GET", `events/${id}`);
  return res.ok ? res.json : null;
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
  trialEndUnix?: number;
  interval?: "month" | "year";
  baseUrl: string;
}): Promise<{ url: string } | { error: string }> {
  try {
    const { prices } = await ensureStripeSetup(params.baseUrl);
    const price = params.interval === "year" ? prices.year : prices.month;
    const session = await stripeRequest("checkout/sessions", {
      ...(params.trialEndUnix ? { "subscription_data[trial_end]": String(params.trialEndUnix) } : {}),
      mode: "subscription",
      "line_items[0][price]": price,
      locale: "fr",
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
  baseUrl: string;
}): Promise<{ url: string } | { error: string }> {
  try {
    await ensureStripeSetup(params.baseUrl);
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
