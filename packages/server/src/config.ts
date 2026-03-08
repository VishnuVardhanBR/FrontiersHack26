import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
dotenv.config({ path: path.join(repoRoot, ".env") });

const asNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBoolean = (value: string | undefined): boolean =>
  value === "1" || value === "true" || value === "yes";

export const config = {
  repoRoot,
  serverHost: process.env.QUIZCRAFT_SERVER_HOST ?? "127.0.0.1",
  serverPort: asNumber(process.env.QUIZCRAFT_SERVER_PORT, 3000),
  frontendPort: asNumber(process.env.QUIZCRAFT_FRONTEND_PORT, 5173),
  botName: process.env.QUIZCRAFT_BOT_NAME ?? "QuizCraftTutor",
  storageDir: path.join(repoRoot, ".storage", "sessions"),
  promptsDir: path.join(repoRoot, "packages", "server", "src", "gemini", "prompts"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  disableGemini: asBoolean(process.env.QUIZCRAFT_DISABLE_GEMINI),
  geminiModelPlanner: process.env.GEMINI_MODEL_PLANNER ?? "gemini-3.1-flash-lite-preview",
  geminiThinkingBudget: Math.max(0, asNumber(process.env.GEMINI_THINKING_BUDGET, 1024)),
  geminiModelVoice: process.env.GEMINI_MODEL_VOICE ?? "gemini-2.5-flash-preview-tts",
  geminiTimeoutMs: asNumber(process.env.GEMINI_TIMEOUT_MS, 60_000),
  geminiMaxAttempts: Math.max(1, asNumber(process.env.GEMINI_MAX_ATTEMPTS, 2)),
  maxUploadSizeBytes: 20 * 1024 * 1024,
} as const;

export const frontendOrigins = [
  `http://${config.serverHost}:${config.frontendPort}`,
  `http://localhost:${config.frontendPort}`,
  `http://127.0.0.1:${config.frontendPort}`,
];
