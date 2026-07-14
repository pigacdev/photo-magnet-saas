import Link from "next/link";
import { LegalFooter } from "@/components/LegalFooter";

type LegalPageShellProps = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: LegalPageShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>
        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
