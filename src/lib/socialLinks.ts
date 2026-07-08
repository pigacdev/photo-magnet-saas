export type SocialPlatform = "facebook" | "instagram" | "discord";

export type SocialLink = {
  platform: SocialPlatform;
  label: string;
  href: string;
};

export function getSocialLinks(): SocialLink[] {
  const entries: Array<[SocialPlatform, string, string | undefined]> = [
    ["facebook", "Facebook", process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL],
    ["instagram", "Instagram", process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL],
    ["discord", "Discord", process.env.NEXT_PUBLIC_SOCIAL_DISCORD_URL],
  ];

  return entries
    .map(([platform, label, raw]) => {
      const href = raw?.trim();
      if (!href) return null;
      return { platform, label, href };
    })
    .filter((link): link is SocialLink => link !== null);
}
