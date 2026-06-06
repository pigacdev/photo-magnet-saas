"use client";

import { useUser } from "@clerk/nextjs";
import type { User } from "@/lib/auth";

export function userInitials(user: User): string {
  if (user.name?.trim()) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

const sizeClasses = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
} as const;

export type DashboardUserAvatarProps = {
  user: User;
  size?: keyof typeof sizeClasses;
  className?: string;
};

/** Matches Clerk UserButton avatar (profile image) with initials fallback. */
export function DashboardUserAvatar({
  user,
  size = "md",
  className = "",
}: DashboardUserAvatarProps) {
  const { user: clerkUser, isLoaded } = useUser();
  const imageUrl = isLoaded ? clerkUser?.imageUrl : undefined;
  const sizeClass = sizeClasses[size];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ${sizeClass} ${className}`}
      aria-hidden
    >
      {userInitials(user)}
    </div>
  );
}
