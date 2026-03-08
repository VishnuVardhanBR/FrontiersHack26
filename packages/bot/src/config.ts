import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(currentDir, "..");
const repoRoot = path.resolve(packageDir, "..", "..");

// Load root .env explicitly so workspace scripts started from packages/bot
// still receive repo-level environment variables.
loadEnv({ path: path.resolve(repoRoot, ".env") });

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
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
  readonly geminiModelWorld: string;
  readonly geminiThinkingBudget: number;
  readonly resumeIncompleteSessions: boolean;
  readonly minecraftlmUrl: string;
  readonly useMinecraftLM: boolean;
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
  geminiModelWorld: process.env.GEMINI_MODEL_WORLD ?? "gemini-2.0-flash",
  geminiThinkingBudget: Math.max(0, parseNumber(process.env.GEMINI_THINKING_BUDGET, 1024)),
  resumeIncompleteSessions: parseBoolean(process.env.QUIZCRAFT_RESUME_INCOMPLETE_SESSIONS, false),
  minecraftlmUrl: process.env.MINECRAFTLM_URL ?? "http://127.0.0.1:8000",
  useMinecraftLM: parseBoolean(process.env.USE_MINECRAFTLM, true),
  sessionId: process.env.QUIZCRAFT_SESSION_ID,
};
