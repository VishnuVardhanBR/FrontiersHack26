import EventEmitter from "node:events";

import mineflayer, { Bot } from "mineflayer";
import mineflayerPathfinder from "mineflayer-pathfinder";

import { BotConfig } from "./config.js";

const { pathfinder } = mineflayerPathfinder;

export interface BotManagerEvents {
  spawned: [];
  ended: [string];
  chat: [string, string];
  error: [Error];
  health: [number, number];
}

export class BotManager extends EventEmitter<BotManagerEvents> {
  private botInstance: Bot | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: BotConfig) {
    super();
  }

  get bot(): Bot {
    if (!this.botInstance) {
      throw new Error("Bot has not connected yet.");
    }

    return this.botInstance;
  }

  async connect(): Promise<Bot> {
    if (this.botInstance?.entity) {
      return this.botInstance;
    }

    const bot = mineflayer.createBot({
      host: this.config.botHost,
      port: this.config.botPort,
      username: this.config.botUsername,
      version: this.config.botVersion,
      auth: "offline",
    });

    bot.loadPlugin(pathfinder);

    bot.on("chat", (username, message) => {
      if (username !== bot.username) {
        this.emit("chat", username, message);
      }
    });

    bot.on("health", () => {
      this.emit("health", bot.health, bot.food);
    });

    bot.on("end", (reason) => {
      this.botInstance = null;
      this.emit("ended", reason);
      this.scheduleReconnect();
    });

    bot.on("error", (error) => {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    });

    this.botInstance = bot;
    return new Promise<Bot>((resolve, reject) => {
      const onSpawn = () => {
        this.emit("spawned");
        this.clearReconnect();
        cleanup();
        resolve(bot);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        bot.off("spawn", onSpawn);
        bot.off("error", onError);
      };

      bot.once("spawn", onSpawn);
      bot.once("error", onError);
    });
  }

  async ensureCreativeMode(): Promise<void> {
    const bot = this.bot;
    bot.chat("/gamemode creative @s");
    bot.chat("/gamerule sendCommandFeedback false");
    bot.chat("/difficulty peaceful");
    // Teleport above ground immediately — the minimal flat world spawns at y=-63
    bot.chat("/tp @s 0 4 0");
    bot.chat("/setworldspawn 0 4 0");
  }

  async disconnect(): Promise<void> {
    this.clearReconnect();
    if (this.botInstance) {
      this.botInstance.quit("QuizCraft bot shutdown");
      this.botInstance = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch((error) => this.emit("error", error instanceof Error ? error : new Error(String(error))));
    }, 3_000);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
