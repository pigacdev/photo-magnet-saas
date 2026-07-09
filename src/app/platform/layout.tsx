import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  getPlatformOwnerEmails,
  isPlatformOwnerEmail,
} from "../../../server/src/lib/platformOwner";
import { PlatformLayoutClient } from "./PlatformLayoutClient";

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

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let email = emailFromSessionClaims(
    sessionClaims as Record<string, unknown> | undefined,
  );

  if (!email) {
    const clerkUser = await currentUser();
    email = clerkUser ? resolveClerkEmail(clerkUser) : null;
  }

  if (!email || !isPlatformOwnerEmail(email)) {
    if (process.env.NODE_ENV !== "production" && getPlatformOwnerEmails().length === 0) {
      console.warn(
        "[platform] PLATFORM_OWNER_EMAILS is unset. Add your Clerk sign-in email to .env.local.",
      );
    }
    notFound();
  }

  return <PlatformLayoutClient>{children}</PlatformLayoutClient>;
}
