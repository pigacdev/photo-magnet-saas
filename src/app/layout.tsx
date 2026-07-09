import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkAuthHeader } from "@/components/auth/ClerkAuthHeader";
import { ClerkTokenBridge } from "@/components/auth/ClerkTokenBridge";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { clerkAppearance } from "@/lib/clerkAppearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Magnetoo",
  description: "Photo magnet SaaS platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground antialiased">
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
        >
          <ThemeProvider>
            <ClerkTokenBridge />
            <ClerkAuthHeader />
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
