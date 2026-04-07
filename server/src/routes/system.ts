import { Router } from "express";
import { SYSTEM_MAX_MAGNETS_PER_ORDER } from "../config/system";

export const systemRouter = Router();

systemRouter.get("/config", (_req, res) => {
  res.json({ maxMagnetsPerOrder: SYSTEM_MAX_MAGNETS_PER_ORDER });
});
