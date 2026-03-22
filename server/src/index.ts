import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { eventsRouter } from "./routes/events";
import { authenticate, requireRole } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config({ path: "../.env" });

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

// --- Public routes ---
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

// --- Protected routes ---
app.use("/api/admin", authenticate, requireRole("ADMIN", "STAFF"));
app.use("/api/events", authenticate, requireRole("ADMIN", "STAFF"), eventsRouter);
app.use("/api/orders", authenticate, requireRole("ADMIN", "STAFF"));
app.use("/api/images", authenticate, requireRole("ADMIN", "STAFF"));
app.use("/api/print", authenticate, requireRole("ADMIN", "STAFF"));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
