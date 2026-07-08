import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getSocialLinks } from "./socialLinks.ts";

const ENV_KEYS = [
  "NEXT_PUBLIC_SOCIAL_FACEBOOK_URL",
  "NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL",
  "NEXT_PUBLIC_SOCIAL_DISCORD_URL",
] as const;

describe("getSocialLinks", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("returns no links when env vars are missing or empty", () => {
    assert.deepEqual(getSocialLinks(), []);
    process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL = "   ";
    assert.deepEqual(getSocialLinks(), []);
  });

  it("returns trimmed links for configured platforms", () => {
    process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL =
      "  https://facebook.com/magnetoo  ";
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL =
      "https://instagram.com/magnetoo";
    process.env.NEXT_PUBLIC_SOCIAL_DISCORD_URL = "https://discord.gg/invite";

    assert.deepEqual(getSocialLinks(), [
      {
        platform: "facebook",
        label: "Facebook",
        href: "https://facebook.com/magnetoo",
      },
      {
        platform: "instagram",
        label: "Instagram",
        href: "https://instagram.com/magnetoo",
      },
      {
        platform: "discord",
        label: "Discord",
        href: "https://discord.gg/invite",
      },
    ]);
  });

  it("returns only platforms with configured URLs", () => {
    process.env.NEXT_PUBLIC_SOCIAL_DISCORD_URL = "https://discord.gg/invite";

    assert.deepEqual(getSocialLinks(), [
      {
        platform: "discord",
        label: "Discord",
        href: "https://discord.gg/invite",
      },
    ]);
  });
});
