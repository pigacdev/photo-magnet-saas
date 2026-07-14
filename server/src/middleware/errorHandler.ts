import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (process.env.NODE_ENV === "production") {
    console.error("[error]", err.message);
  } else {
    console.error(err.stack);
  }
  res.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}
