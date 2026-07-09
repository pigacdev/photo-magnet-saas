"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { AppUserButton } from "@/components/auth/AppUserButton";

export function ClerkAuthHeader() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/platform") ||
    pathname.startsWith("/order") ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/event") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  ) {
    return null;
  }

  return (
    <header className="flex items-center justify-end gap-3 border-b border-border px-6 py-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <AppUserButton />
      </Show>
    </header>
  );
}
