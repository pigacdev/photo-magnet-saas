import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Dashboard
        </h1>
        <p className="mt-2 text-[#6B7280]">
          Manage your events and orders.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/events"
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-gray-300 hover:bg-[#F9FAFB]"
        >
          <h2 className="text-base font-medium text-[#111111]">Events</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create and manage your events.
          </p>
        </Link>
      </div>
    </div>
  );
}
