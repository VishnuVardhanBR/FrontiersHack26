import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(currentDir, "..");
const repoRoot = path.resolve(packageDir, "..", "..");

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface BotConfig {
  readonly repoRoot: string;
  readonly storageRoot: string;
  readonly botUsername: string;
  readonly botHost: string;
  readonly botPort: number;
  readonly botVersion: string;
  readonly scanIntervalMs: number;
  readonly tickIntervalMs: number;
  readonly routeRadius: number;
  readonly geminiApiKey?: string;
  readonly sessionId?: string;
}

export const botConfig: BotConfig = {
  repoRoot,
  storageRoot: path.resolve(repoRoot, ".storage", "sessions"),
  botUsername: process.env.QUIZCRAFT_BOT_NAME ?? process.env.QUIZCRAFT_BOT_USERNAME ?? "QuizCraftTutor",
  botHost: process.env.QUIZCRAFT_MC_HOST ?? process.env.MC_HOST ?? "127.0.0.1",
  botPort: parseNumber(process.env.QUIZCRAFT_MC_PORT ?? process.env.MC_PORT, 25565),
  botVersion: process.env.QUIZCRAFT_MC_VERSION ?? process.env.MC_VERSION ?? "1.21.11",
  scanIntervalMs: parseNumber(process.env.QUIZCRAFT_SCAN_INTERVAL_MS, 2_000),
  tickIntervalMs: parseNumber(process.env.QUIZCRAFT_TICK_MS, 500),
  routeRadius: parseNumber(process.env.QUIZCRAFT_ROUTE_RADIUS, 4),
  geminiApiKey: process.env.GEMINI_API_KEY,
  sessionId: process.env.QUIZCRAFT_SESSION_ID,
};
