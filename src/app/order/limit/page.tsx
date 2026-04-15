import Link from "next/link";

export default function OrderLimitPage() {
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="mb-4 text-xl font-semibold text-[#111111]">
        Orders temporarily unavailable
      </h1>

      <p className="mb-6 text-sm text-[#6B7280]">
        This store has reached its monthly order limit. Please try again later.
      </p>

      <Link
        href="/"
        className="inline-block rounded-lg bg-[#111111] px-4 py-2 text-sm font-medium text-white"
      >
        Back to home
      </Link>
    </div>
  );
}
