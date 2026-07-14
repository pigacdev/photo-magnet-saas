export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "discord"
  | "youtube"
  | "tiktok";

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
    ["youtube", "YouTube", process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL],
    ["tiktok", "TikTok", process.env.NEXT_PUBLIC_SOCIAL_TIKTOK_URL],
  ];

  return entries
    .map(([platform, label, raw]) => {
      const href = raw?.trim();
      if (!href) return null;
      return { platform, label, href };
    })
    .filter((link): link is SocialLink => link !== null);
}
