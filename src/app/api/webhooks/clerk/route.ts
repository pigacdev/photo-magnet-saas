import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import {
  displayNameFromClerk,
  ensureSellerUser,
  softDeleteSellerByClerkId,
} from "@/lib/clerkUserSync";
import { applyClerkBillingEvent } from "@/lib/clerkBillingSync";
import {
  isClerkEventProcessed,
  markClerkEventProcessed,
} from "@/lib/clerkWebhookIdempotency";

function webhookSigningSecret(): string | undefined {
  return (
    process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim() ||
    process.env.CLERK_WEBHOOK_SECRET?.trim() ||
    undefined
  );
}

export async function POST(req: NextRequest) {
  const signingSecret = webhookSigningSecret();
  if (!signingSecret) {
    return new Response("CLERK_WEBHOOK_SIGNING_SECRET is not configured", {
      status: 500,
    });
  }

  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret });
  } catch (err) {
    console.error("[clerk.webhook] verification failed", err);
    return new Response("Verification failed", { status: 400 });
  }

  const svixId = req.headers.get("svix-id");
  if (svixId && (await isClerkEventProcessed(svixId))) {
    return new Response("OK", { status: 200 });
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const { id, email_addresses, first_name, last_name, username } = evt.data;
      const primaryEmail = email_addresses.find(
        (entry) => entry.id === evt.data.primary_email_address_id,
      )?.email_address;

      if (primaryEmail) {
        const name = displayNameFromClerk(username, first_name, last_name);
        await ensureSellerUser({
          clerkId: id,
          email: primaryEmail,
          name,
        });
      }
    }

    if (evt.type === "user.deleted") {
      await softDeleteSellerByClerkId(evt.data.id);
    }

    if (
      evt.type.startsWith("subscription.") ||
      evt.type.startsWith("subscriptionItem.")
    ) {
      await applyClerkBillingEvent(evt);
    }

    if (svixId) {
      await markClerkEventProcessed(svixId);
    }
  } catch (err) {
    console.error("[clerk.webhook] handler error", evt.type, err);
    return new Response("Handler failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
