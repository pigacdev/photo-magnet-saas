export const authConfig = {
  jwtSecret: process.env.JWT_SECRET || "CHANGE_ME_IN_PRODUCTION",
  jwtExpiresIn: "7d" as const,
  bcryptRounds: 12,
  cookieName: "token",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: "/",
  },
  passwordMinLength: 8,
};
