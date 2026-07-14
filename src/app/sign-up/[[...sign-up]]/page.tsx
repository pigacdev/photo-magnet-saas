import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { LegalFooter } from "@/components/LegalFooter";
import { LEGAL_LINKS } from "@/lib/legalConstants";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <SignUp fallbackRedirectUrl="/dashboard" signInUrl="/sign-in" />
        <p className="mt-4 max-w-sm text-center text-xs text-muted-foreground">
          By signing up you agree to our{" "}
          <Link href={LEGAL_LINKS.terms} className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href={LEGAL_LINKS.privacy} className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      <LegalFooter compact />
    </div>
  );
}
