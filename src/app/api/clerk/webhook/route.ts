import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "~/server/db";

// Create new Svix instance with secret
const SIGNING_SECRET = process.env.SIGNING_SECRET;
if (!SIGNING_SECRET) {
  throw new Error(
    "Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local",
  );
}
const wh = new Webhook(SIGNING_SECRET);

export const POST = async (req: Request) => {
  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error: Could not verify webhook:", err);
    return new Response("Error: Verification error", {
      status: 400,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === "user.created") {
    try {
      await db.user.create({
        data: {
          id,
          firstName: evt.data.first_name ?? "Unknown",
          lastName: evt.data.last_name ?? "",
          email: evt.data.email_addresses[0]?.email_address ?? "",
          imageUrl: evt.data.image_url,
        },
      });
    } catch (err) {
      console.error("Error: Could not create user in database:", err);
      return new Response("Error: Database error", {
        status: 500,
      });
    }
  }

  return new Response("Webhook received", { status: 200 });
};
