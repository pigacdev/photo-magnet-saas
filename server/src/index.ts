import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { healthRouter } from "./routes/health";

dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/health", healthRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
