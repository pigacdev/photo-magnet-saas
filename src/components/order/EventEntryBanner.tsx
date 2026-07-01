type EventEntryBannerProps = {
  bannerUrl: string;
  /** Break out of OrderShell horizontal padding (`-mx-4`). */
  inset?: boolean;
  className?: string;
};

export function EventEntryBanner({
  bannerUrl,
  inset = false,
  className = "",
}: EventEntryBannerProps) {
  return (
    <div
      className={`overflow-hidden ${inset ? "-mx-4 mb-6" : ""} ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bannerUrl}
        alt=""
        className="aspect-[3/1] max-h-48 w-full object-cover"
      />
    </div>
  );
}
