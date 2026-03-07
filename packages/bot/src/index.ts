import "dotenv/config";

import { BotManager } from "./bot-manager.js";
import { botConfig } from "./config.js";
import { SessionRunner } from "./session-runner.js";
import { SessionFileRepository } from "./storage/session-file-repository.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isConnectionRefused = (err: unknown): boolean =>
  err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ECONNREFUSED";

/** Retry connect with exponential backoff; exit with clear message after max attempts. */
const connectWithRetry = async (manager: BotManager): Promise<void> => {
  const maxAttempts = 5;
  const baseDelayMs = 3000;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await manager.connect();
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxAttempts) break;
      const waitMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30_000);
      console.warn(
        `[bot] Minecraft server at ${botConfig.botHost}:${botConfig.botPort} not reachable (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs / 1000}s...`,
      );
      await delay(waitMs);
    }
  }

  console.error("[bot] Could not connect to Minecraft server after %d attempts.", maxAttempts);
  console.error("[bot] Start the Minecraft server (e.g. ./mc-server/start.sh) then run the bot again.");
  throw lastErr ?? new Error("Connection failed");
};

const main = async (): Promise<void> => {
  const repository = new SessionFileRepository(botConfig.storageRoot);
  const manager = new BotManager(botConfig);
  const runner = new SessionRunner({
    repository,
    manager,
    config: botConfig,
  });

  manager.on("spawned", () => {
    console.log("[bot] Spawned on Minecraft server");
  });

  manager.on("ended", (reason) => {
    console.warn(`[bot] Disconnected: ${reason}`);
  });

  manager.on("error", (error) => {
    if (isConnectionRefused(error)) return;
    console.error("[bot] error", error);
  });

  await repository.ensureStorageRoot();
  await connectWithRetry(manager);

  while (true) {
    const available = await repository.listAvailableSessions(botConfig.botUsername);
    const nextSession = botConfig.sessionId
      ? available.find((session) => session.id === botConfig.sessionId)
      : available[0];

    if (nextSession) {
      await runner.tryRun(nextSession);
    }

    await delay(botConfig.scanIntervalMs);
  }
};

void main().catch((error) => {
  console.error("[bot] fatal", error);
  process.exitCode = 1;
});
