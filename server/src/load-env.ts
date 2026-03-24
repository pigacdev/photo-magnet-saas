import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/load-env.ts → project root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
