import { getSocialLinks } from "@/lib/socialLinks";
import { SocialIcon } from "./SocialIcon";

export function SidebarSocialLinks() {
  const links = getSocialLinks();

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="mt-auto border-t border-border pt-3">
      <div className="flex items-center gap-1 px-1">
        {links.map((link) => (
          <a
            key={link.platform}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <span className="size-5 shrink-0 [&>svg]:size-5">
              <SocialIcon platform={link.platform} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
