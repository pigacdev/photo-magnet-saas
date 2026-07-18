export type DashboardNavIconName =
  | "home"
  | "orders"
  | "customers"
  | "events"
  | "storefront"
  | "calendar"
  | "notifications";

export function DashboardNavIcon({
  name,
  className = "size-5 shrink-0",
}: {
  name: DashboardNavIconName;
  className?: string;
}) {
  switch (name) {
    case "home":
      return (
        <svg
          className={className}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8.5 10 3l7 5.5V16a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 16V8.5z"
          />
          <path strokeLinecap="round" d="M8 17.5V11h4v6.5" />
        </svg>
      );
    case "orders":
      return (
        <svg
          className={className}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 3.5h8l1.5 2H4.5L6 3.5zM5 7h10v9.5a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 16.5V7z"
          />
          <path strokeLinecap="round" d="M8 10h4M8 13h4" />
        </svg>
      );
    case "customers":
      return (
        <svg
          className={className}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 16.5v-.75a4.25 4.25 0 0 1 4.25-4.25h2.5A4.25 4.25 0 0 1 15.5 15.75v.75"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.5 9.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zM5.5 9.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zM3 16.5v-.5a3.25 3.25 0 0 1 3.25-3.25M16 16.5v-.5a3.25 3.25 0 0 0-3.25-3.25"
          />
        </svg>
      );
    case "events":
      return (
        <svg
          className={className}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.5 4V3M13.5 4V3M4.5 7h11M5.5 5h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
          />
          <path strokeLinecap="round" d="M7 10h2M11 10h2M7 13h2M11 13h2" />
        </svg>
      );
    case "storefront":
      return (
        <svg
          className={className}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.5 8 10 3.5 16.5 8V16a1 1 0 0 1-1 1h-3.5v-4H8v4H5a1 1 0 0 1-1-1V8z"
          />
          <path strokeLinecap="round" d="M3.5 8h13" />
        </svg>
      );
    case "calendar":
      return (
        <svg
          className={className}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.5 4V3M13.5 4V3M4.5 7h11M5.5 5h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
          />
          <path strokeLinecap="round" d="M7 10h2M11 10h2" />
        </svg>
      );
    case "notifications":
      return (
        <svg
          className={className}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16.5h4M5.5 14h9l-1-1.5V9a4.5 4.5 0 1 0-9 0v3.5L5.5 14z"
          />
        </svg>
      );
  }
}
