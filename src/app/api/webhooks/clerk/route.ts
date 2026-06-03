import { verifyWebhook } from "@clerk/backend/webhooks";
import { NextResponse } from "next/server";
import {
  displayNameFromClerk,
  ensureSellerUser,
} from "@/lib/clerkUserSync";

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "CLERK_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  let event;
  try {
    event = await verifyWebhook(req, { signingSecret: webhookSecret });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, first_name, last_name, username } = event.data;
    const primaryEmail = email_addresses.find(
      (entry) => entry.id === event.data.primary_email_address_id,
    )?.email_address;

    if (!primaryEmail) {
      return NextResponse.json({ received: true });
    }

    const name = displayNameFromClerk(
      username,
      first_name,
      last_name,
    );

    await ensureSellerUser({
      clerkId: id,
      email: primaryEmail,
      name,
    });
  }

  return NextResponse.json({ received: true });
}
