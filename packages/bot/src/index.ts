import "dotenv/config";

import { BotManager } from "./bot-manager.js";
import { botConfig } from "./config.js";
import { SessionRunner } from "./session-runner.js";
import { SessionFileRepository } from "./storage/session-file-repository.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async (): Promise<void> => {
  const repository = new SessionFileRepository(botConfig.storageRoot);
  const manager = new BotManager(botConfig);
  const runner = new SessionRunner({
    repository,
    manager,
    config: botConfig,
  });

  manager.on("spawned", () => {
    console.log("Bot spawned");
  });

  manager.on("ended", (reason) => {
    console.warn(`[bot] disconnected: ${reason}`);
  });

  manager.on("error", (error) => {
    console.error("[bot] error", error);
  });

  await repository.ensureStorageRoot();
  await manager.connect();

  while (true) {
    const available = await repository.listAvailableSessions(botConfig.botUsername, {
      allowResumeIncomplete: botConfig.resumeIncompleteSessions,
    });
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
