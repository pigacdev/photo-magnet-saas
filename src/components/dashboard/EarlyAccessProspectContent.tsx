import Link from "next/link";
import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";
import {
  EARLY_ACCESS_HEADLINE,
  EARLY_ACCESS_LIFETIME_DISCOUNT_SUBLINE,
  EARLY_ACCESS_PROSPECT_BODY,
} from "@/lib/earlyAccessCopy";
import { LEGAL_LINKS } from "@/lib/legalConstants";
import { EarlyAccessFeedbackLinks } from "@/components/dashboard/EarlyAccessFeedbackLinks";

export const EARLY_ACCESS_PROSPECT_CARD_CLASS =
  "rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-background shadow-sm dark:border-primary/30 dark:from-primary/15 dark:via-primary/[0.06] dark:to-card";

export function EarlyAccessClockIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

type Props = {
  status: EarlyAccessStatus;
};

export function EarlyAccessProspectContent({ status }: Props) {
  const seatWord = status.seatsRemaining === 1 ? "seat" : "seats";

  return (
    <div className="flex min-w-0 gap-3">
      <span
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
        aria-hidden
      >
        <EarlyAccessClockIcon />
      </span>

      <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed text-muted-foreground">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            {EARLY_ACCESS_HEADLINE}
          </h2>
          <p>
            {EARLY_ACCESS_PROSPECT_BODY}
            {" · "}
            <span className="font-bold tabular-nums text-foreground">
              {status.seatsRemaining} {seatWord} remaining
            </span>
          </p>
        </div>

        <p>
          <span className="font-semibold text-foreground">
            Lifetime 20% off Hobby &amp; Pro.
          </span>{" "}
          {EARLY_ACCESS_LIFETIME_DISCOUNT_SUBLINE}{" "}
          <Link
            href={LEGAL_LINKS.earlyAccessDiscountTerms}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Terms apply
          </Link>
        </p>

        <EarlyAccessFeedbackLinks tone="neutral" />
      </div>
    </div>
  );
}

export function EarlyAccessProspectCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${EARLY_ACCESS_PROSPECT_CARD_CLASS} px-4 py-4 sm:px-5 sm:py-5 ${className}`}
      role="status"
    >
      {children}
    </div>
  );
}
