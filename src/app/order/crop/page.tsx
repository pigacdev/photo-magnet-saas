import Link from "next/link";

/** Placeholder until crop step is implemented. */
export default function OrderCropPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 pb-10 pt-8">
      <h1 className="text-2xl font-semibold text-[#111111]">Crop</h1>
      <p className="text-sm text-[#6B7280]">This step is not built yet.</p>
      <Link
        href="/order/photos"
        className="text-center text-sm text-[#2563EB] underline-offset-4 hover:underline"
      >
        Back to photos
      </Link>
    </div>
  );
}
