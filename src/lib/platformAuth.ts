import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isPlatformOwnerEmail } from "../../server/src/lib/platformOwner";

function resolveClerkEmail(
  clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
): string | null {
  const primary = clerkUser.primaryEmailAddress?.emailAddress;
  if (primary) return primary;

  const verified = clerkUser.emailAddresses.find(
    (entry) => entry.verification?.status === "verified",
  )?.emailAddress;
  if (verified) return verified;

  return clerkUser.emailAddresses[0]?.emailAddress ?? null;
}

function emailFromSessionClaims(
  sessionClaims: Record<string, unknown> | null | undefined,
): string | null {
  const email = sessionClaims?.email;
  return typeof email === "string" && email.trim() ? email : null;
}

export async function resolvePlatformOwnerEmail(): Promise<string | null> {
  const { sessionClaims } = await auth();
  let email = emailFromSessionClaims(
    sessionClaims as Record<string, unknown> | undefined,
  );
  if (email) return email;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  return resolveClerkEmail(clerkUser);
}

/** Returns a NextResponse error or null when the caller is a platform owner. */
export async function requirePlatformOwnerResponse(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = await resolvePlatformOwnerEmail();
  if (!email || !isPlatformOwnerEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
