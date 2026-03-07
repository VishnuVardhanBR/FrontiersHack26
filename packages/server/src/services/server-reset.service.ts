import { execFile as execFileCallback, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

import type { SessionStatus } from "@quizcraft/shared";

import { config } from "../config.js";
import { BotBridgeService } from "./bot-bridge.service.js";
import { SessionService } from "./session.service.js";

const execFile = promisify(execFileCallback);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RESETTABLE_WORLD_PATHS = [
  "world",
  "world_nether",
  "world_the_end",
];

const ACTIVE_SESSION_STATUSES = new Set<SessionStatus>([
  "planning",
  "queued",
  "building_scene",
  "waiting_for_player",
  "introducing",
  "escorting",
  "narrating",
  "asking_question",
  "evaluating_answer",
  "monitoring_objective",
  "climax_recap",
]);

export class ServerResetService {
  private resetInFlight: Promise<void> | null = null;

  constructor(
    private readonly sessionService: SessionService,
    private readonly botBridgeService: BotBridgeService,
  ) {}

  async resetForNewLesson(): Promise<void> {
    if (!this.resetInFlight) {
      this.resetInFlight = this.performReset().finally(() => {
        this.resetInFlight = null;
      });
    }

    return this.resetInFlight;
  }

  private async performReset(): Promise<void> {
    await this.failActiveSessions();
    await this.stopMinecraftServer();
    await this.resetWorldDirectories();
    this.startMinecraftServer();
    await this.waitForPortState(true, 25_000);
  }

  private async failActiveSessions(): Promise<void> {
    const sessions = await this.sessionService.listSessions();

    for (const session of sessions) {
      if (!ACTIVE_SESSION_STATUSES.has(session.status)) {
        continue;
      }

      await this.botBridgeService.failSession(
        session.id,
        "Server reset requested from dashboard. Start a new lesson from the upload screen.",
      );
    }
  }

  private async stopMinecraftServer(): Promise<void> {
    const pids = await this.findMinecraftPids();
    if (pids.length === 0) {
      return;
    }

    for (const pid of pids) {
      this.killIfRunning(pid, "SIGTERM");
    }

    await delay(1_500);

    const remaining = pids.filter((pid) => this.isRunning(pid));
    for (const pid of remaining) {
      this.killIfRunning(pid, "SIGKILL");
    }

    await this.waitForPortState(false, 10_000);
  }

  private async resetWorldDirectories(): Promise<void> {
    for (const target of RESETTABLE_WORLD_PATHS) {
      await fs.rm(path.join(config.mcServerDir, target), { recursive: true, force: true });
    }
  }

  private startMinecraftServer(): void {
    const startScript = path.join(config.mcServerDir, "start.sh");
    const child = spawn(startScript, [], {
      cwd: config.mcServerDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }

  private async findMinecraftPids(): Promise<number[]> {
    try {
      const { stdout } = await execFile("lsof", [`-tiTCP:${config.mcPort}`, "-sTCP:LISTEN"]);
      return stdout
        .split("\n")
        .map((line) => Number(line.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch (error) {
      const execError = error as NodeJS.ErrnoException & { code?: number | string };
      if (String(execError.code ?? "") === "1") {
        return [];
      }
      throw error;
    }
  }

  private killIfRunning(pid: number, signal: NodeJS.Signals): void {
    try {
      process.kill(pid, signal);
    } catch (error) {
      const killError = error as NodeJS.ErrnoException;
      if (killError.code !== "ESRCH") {
        throw error;
      }
    }
  }

  private isRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async waitForPortState(shouldBeOpen: boolean, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const isOpen = await this.isMinecraftPortOpen();
      if (isOpen === shouldBeOpen) {
        return;
      }

      await delay(500);
    }

    throw new Error(
      shouldBeOpen
        ? "Minecraft server did not come back online after reset."
        : "Minecraft server did not shut down cleanly during reset.",
    );
  }

  private async isMinecraftPortOpen(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = net.createConnection({
        host: config.mcHost,
        port: config.mcPort,
      });

      const finish = (value: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(value);
      };

      socket.setTimeout(750);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
    });
  }
}
