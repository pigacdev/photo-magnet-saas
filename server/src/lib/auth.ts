import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authConfig } from "../config/auth";

export interface JwtPayload {
  userId: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, authConfig.bcryptRounds);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.jwtExpiresIn,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, authConfig.jwtSecret) as JwtPayload;
}
