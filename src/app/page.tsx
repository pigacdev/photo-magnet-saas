import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Photo Magnet
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          From photo to printed magnet in minutes.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
