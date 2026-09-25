import { NextRequest, NextResponse } from "next/server";
import { dbRun } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/stripe";

// Point d'entrée Stripe : bascule le plan du coach à la confirmation du
// paiement, et le repasse gratuit si l'abonnement est résilié ou impayé.
// Le corps doit rester la chaîne brute reçue (request.text(), pas .json())
// pour que la vérification de signature porte sur les octets exacts signés
// par Stripe — un JSON.stringify(JSON.parse(...)) ne redonnerait pas
// forcément la même chaîne et invaliderait la signature.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook Stripe non configuré." }, { status: 500 });

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature || !verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const coachId = session.client_reference_id as string | null;
      const customerId = session.customer as string | null;
      if (coachId) {
        await dbRun(`UPDATE users SET plan = 'pro', stripe_customer_id = ? WHERE id = ? AND role = 'coach'`, [
          customerId,
          coachId,
        ]);
      }
      break;
    }
    // 'updated' couvre aussi bien la réactivation après impayé que la
    // résiliation programmée en fin de période — le statut fait foi dans les
    // deux cas, pas le type d'événement seul.
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const status = subscription.status as string;
      const isActive = status === "active" || status === "trialing";
      await dbRun(`UPDATE users SET plan = ? WHERE stripe_customer_id = ?`, [isActive ? "pro" : "free", customerId]);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
