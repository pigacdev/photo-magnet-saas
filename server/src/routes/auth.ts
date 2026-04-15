import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../lib/auth";
import { authConfig } from "../config/auth";
import { defaultBillingPeriodEnd } from "../lib/saas";

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a minute." },
});

export const authRouter = Router();

authRouter.post("/signup", authLimiter, async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (password.length < authConfig.passwordMinLength) {
    res
      .status(400)
      .json({ error: `Password must be at least ${authConfig.passwordMinLength} characters` });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email, deletedAt: null },
  });

  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);

  const periodEnd = defaultBillingPeriodEnd();

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, name: name || null, passwordHash },
    });
    await tx.organization.create({
      data: {
        id: u.id,
        currentPeriodEnd: periodEnd,
      },
    });
    return u;
  });

  const token = signToken({ userId: user.id, role: user.role });

  res.cookie(authConfig.cookieName, token, authConfig.cookieOptions);

  const organization = await prisma.organization.findUnique({
    where: { id: user.id },
    select: { plan: true, ordersThisMonth: true, orderLimit: true },
  });

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    organization: organization
      ? {
          plan: organization.plan,
          ordersThisMonth: organization.ordersThisMonth,
          orderLimit: organization.orderLimit,
        }
      : null,
  });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
  });

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });

  res.cookie(authConfig.cookieName, token, authConfig.cookieOptions);

  const organization = await prisma.organization.findUnique({
    where: { id: user.id },
    select: { plan: true, ordersThisMonth: true, orderLimit: true },
  });

  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    organization: organization
      ? {
          plan: organization.plan,
          ordersThisMonth: organization.ordersThisMonth,
          orderLimit: organization.orderLimit,
        }
      : null,
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(authConfig.cookieName, { path: "/" });
  res.json({ success: true });
});

authRouter.get("/me", async (req, res) => {
  const token = req.cookies?.[authConfig.cookieName];

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId, deletedAt: null },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.id },
      select: {
        plan: true,
        ordersThisMonth: true,
        orderLimit: true,
      },
    });

    const freshToken = signToken({ userId: user.id, role: user.role });
    res.cookie(authConfig.cookieName, freshToken, authConfig.cookieOptions);

    res.json({
      user,
      organization: organization
        ? {
            plan: organization.plan,
            ordersThisMonth: organization.ordersThisMonth,
            orderLimit: organization.orderLimit,
          }
        : null,
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
