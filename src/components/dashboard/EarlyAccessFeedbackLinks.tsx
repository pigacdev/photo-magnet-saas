import Link from "next/link";
import { getSocialLinks } from "@/lib/socialLinks";

type Tone = "amber" | "onBrand";

const toneClasses: Record<Tone, { text: string; link: string }> = {
  amber: {
    text: "text-sm text-amber-900/90 dark:text-amber-200/90",
    link: "font-medium text-amber-950 underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-800 dark:text-amber-100 dark:decoration-amber-300/50 dark:hover:decoration-amber-200",
  },
  onBrand: {
    text: "text-sm text-white/90",
    link: "font-medium text-white underline decoration-white/60 underline-offset-2 hover:decoration-white",
  },
};

export function EarlyAccessFeedbackLinks({
  tone = "amber",
}: {
  tone?: Tone;
}) {
  const discordLink = getSocialLinks().find((link) => link.platform === "discord");
  const classes = toneClasses[tone];

  return (
    <p className={classes.text}>
      Share feedback via{" "}
      <Link href="/dashboard/support" className={classes.link}>
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
            className={classes.link}
          >
            Discord
          </a>
        </>
      ) : null}
      .
    </p>
  );
}
