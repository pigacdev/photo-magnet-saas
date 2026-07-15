import Link from "next/link";
import { getSocialLinks } from "@/lib/socialLinks";

export function EarlyAccessFeedbackLinks() {
  const discordLink = getSocialLinks().find((link) => link.platform === "discord");

  return (
    <p className="text-sm text-amber-900/90 dark:text-amber-200/90">
      Share feedback via{" "}
      <Link
        href="/dashboard/support"
        className="font-medium text-amber-950 underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-800 dark:text-amber-100 dark:decoration-amber-300/50 dark:hover:decoration-amber-200"
      >
        Support
      </Link>
      {discordLink ? (
        <>
          {" "}
          or{" "}
          <a
            href={discordLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-amber-950 underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-800 dark:text-amber-100 dark:decoration-amber-300/50 dark:hover:decoration-amber-200"
          >
            Discord
          </a>
        </>
      ) : null}
      .
    </p>
  );
}
