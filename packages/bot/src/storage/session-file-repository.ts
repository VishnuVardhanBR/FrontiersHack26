import fs from "node:fs/promises";
import path from "node:path";

import { SessionEvent, SessionState, normalizeSessionState, withTimestamp } from "../contracts.js";

export class SessionFileRepository {
  constructor(private readonly storageRoot: string) {}

  private getSessionDir(sessionId: string): string {
    return path.join(this.storageRoot, sessionId);
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), "session.json");
  }

  private getEventsPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), "events.ndjson");
  }

  async ensureStorageRoot(): Promise<void> {
    await fs.mkdir(this.storageRoot, { recursive: true });
  }

  async listSessionIds(): Promise<string[]> {
    await this.ensureStorageRoot();
    const entries = await fs.readdir(this.storageRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  }

  async load(sessionId: string): Promise<SessionState | null> {
    try {
      const raw = await fs.readFile(this.getSessionPath(sessionId), "utf8");
      return normalizeSessionState(JSON.parse(raw), sessionId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async save(session: SessionState): Promise<void> {
    const dir = this.getSessionDir(session.id);
    await fs.mkdir(dir, { recursive: true });
    const payload = withTimestamp(session);
    await fs.writeFile(this.getSessionPath(session.id), JSON.stringify(payload, null, 2));
  }

  async appendEvent(event: SessionEvent): Promise<void> {
    const dir = this.getSessionDir(event.sessionId);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(this.getEventsPath(event.sessionId), `${JSON.stringify(this.toSharedEvent(event))}\n`);
  }

  async listAvailableSessions(botUsername: string): Promise<SessionState[]> {
    const ids = await this.listSessionIds();
    const sessions = await Promise.all(ids.map((id) => this.load(id)));

    return sessions
      .filter((session): session is SessionState => Boolean(session))
      .filter((session) => {
        if (session.summary) {
          return false;
        }

        if (session.claimedBy && session.claimedBy !== botUsername) {
          return false;
        }

        return [
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
        ].includes(session.status);
      })
      .sort((left, right) => {
        const leftAt = Date.parse(left.updatedAt ?? left.createdAt ?? "");
        const rightAt = Date.parse(right.updatedAt ?? right.createdAt ?? "");
        return rightAt - leftAt;
      });
  }

  async claim(sessionId: string, botUsername: string): Promise<SessionState | null> {
    const session = await this.load(sessionId);
    if (!session) {
      return null;
    }

    if (session.claimedBy && session.claimedBy !== botUsername) {
      return null;
    }

    const claimed: SessionState = {
      ...session,
      claimedBy: botUsername,
      claimedAt: new Date().toISOString(),
      status: session.status === "queued" ? "building_scene" : session.status,
    };

    await this.save(claimed);
    await this.appendEvent({
      type: "status",
      sessionId,
      at: new Date().toISOString(),
      payload: {
        status: claimed.status,
        message: `${botUsername} claimed the session and is preparing the scene.`,
      },
    });

    return claimed;
  }

  private toSharedEvent(event: SessionEvent): Record<string, unknown> {
    switch (event.type) {
      case "status":
        return {
          type: "status",
          timestamp: event.at,
          data: {
            status: String(event.payload.status ?? "queued"),
            message: String(event.payload.message ?? "Session updated."),
          },
        };
      case "chat":
        return {
          type: "chat",
          timestamp: event.at,
          data: event.payload,
        };
      case "build_progress":
        return {
          type: "build_progress",
          timestamp: event.at,
          data: {
            completedCommands: Number(event.payload.completedCommands ?? 0),
            totalCommands: Number(event.payload.totalCommands ?? 0),
            percent: Number(event.payload.percent ?? event.payload.progress ?? 0),
            currentStep: String(event.payload.currentStep ?? "Building scene"),
          },
        };
      case "question_result":
        return {
          type: "question_result",
          timestamp: event.at,
          data: {
            questionId: String(event.payload.questionId ?? "question"),
            correct: Boolean(event.payload.correct ?? event.payload.matched),
            feedback: String(event.payload.feedback ?? "Question evaluated."),
            scoreDelta: Number(event.payload.scoreDelta ?? event.payload.score ?? 0),
          },
        };
      case "session_complete":
        return {
          type: "session_complete",
          timestamp: event.at,
          data: event.payload,
        };
      case "error":
      default:
        return {
          type: "error",
          timestamp: event.at,
          data: {
            message: String(event.payload.message ?? "Unexpected bot error."),
          },
        };
    }
  }
}
