import "./load-env";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { eventsRouter } from "./routes/events";
import { storefrontsRouter } from "./routes/storefronts";
import { pricingRouter } from "./routes/pricing";
import { publicRouter } from "./routes/public";
import { sessionRouter } from "./routes/session";
import { systemRouter } from "./routes/system";
import { ordersRouter } from "./routes/orders";
import { authenticate, requireRole } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "order-images"), { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// --- Public routes ---
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);
app.use("/api/system", systemRouter);
app.use("/api/session", sessionRouter);
app.use("/api/orders", ordersRouter);

// --- Protected routes ---
app.use("/api/admin", authenticate, requireRole("ADMIN", "STAFF"));
app.use("/api/events", authenticate, requireRole("ADMIN", "STAFF"), eventsRouter);
app.use("/api/storefronts", authenticate, requireRole("ADMIN", "STAFF"), storefrontsRouter);
app.use("/api/pricing", authenticate, requireRole("ADMIN", "STAFF"), pricingRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
