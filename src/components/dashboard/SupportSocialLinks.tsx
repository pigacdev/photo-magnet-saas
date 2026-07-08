import { getSocialLinks } from "@/lib/socialLinks";
import { SocialIcon } from "./SocialIcon";

export function SupportSocialLinks() {
  const links = getSocialLinks();

  if (links.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        You can also try reaching us or other Magnetoo members through our
        social channels:
      </p>
      <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        {links.map((link) => (
          <li key={link.platform}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              <span className="size-4 shrink-0 [&>svg]:size-4">
                <SocialIcon platform={link.platform} />
              </span>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
