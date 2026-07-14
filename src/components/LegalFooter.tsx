import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legalConstants";

type LegalFooterProps = {
  className?: string;
  compact?: boolean;
  /** When true, links open in a new tab (e.g. during checkout so the buyer keeps their order). */
  openLinksInNewTab?: boolean;
};

export function LegalFooter({
  className = "",
  compact = false,
  openLinksInNewTab = false,
}: LegalFooterProps) {
  const linkClass =
    "text-muted-foreground underline-offset-2 hover:text-foreground hover:underline";
  const linkTarget = openLinksInNewTab
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <footer
      className={`border-t border-border px-4 py-6 text-center text-xs text-muted-foreground ${className}`}
      aria-label="Legal links"
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href={LEGAL_LINKS.privacy} className={linkClass} {...linkTarget}>
          Privacy Policy
        </Link>
        <Link href={LEGAL_LINKS.terms} className={linkClass} {...linkTarget}>
          Terms of Service
        </Link>
        <Link href={LEGAL_LINKS.cookies} className={linkClass} {...linkTarget}>
          Cookie Policy
        </Link>
        {!compact ? (
          <>
            <Link href={LEGAL_LINKS.subprocessors} className={linkClass} {...linkTarget}>
              Subprocessors
            </Link>
            <Link href={LEGAL_LINKS.imprint} className={linkClass} {...linkTarget}>
              Imprint
            </Link>
          </>
        ) : null}
      </nav>
    </footer>
  );
}
