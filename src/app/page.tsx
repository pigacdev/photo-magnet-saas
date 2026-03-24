import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[#111111]">
          Photo Magnet
        </h1>
        <p className="mt-3 text-lg text-[#6B7280]">
          From photo to printed magnet in minutes.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
