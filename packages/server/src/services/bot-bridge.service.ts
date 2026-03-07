import { EventEmitter } from "node:events";

import {
  type BuildPlan,
  type BuildProgress,
  type ChatMessage,
  type SSEEvent,
  type SessionState,
  type SessionStatus,
  type SessionSummary,
} from "@quizcraft/shared";

import { EventBuffer } from "./event-buffer.js";
import { SessionService } from "./session.service.js";

export class BotBridgeService extends EventEmitter {
  constructor(
    private readonly sessionService: SessionService,
    private readonly eventBuffer: EventBuffer,
  ) {
    super();
  }

  async queueSession(sessionId: string): Promise<SessionState> {
    return this.updateStatus(
      sessionId,
      "planned",
      "Experience ready. Press 'Start Build' to launch the scene in Minecraft.",
    );
  }

  async startSession(sessionId: string): Promise<SessionState> {
    return this.updateStatus(
      sessionId,
      "queued",
      "Build started. The tutor bot will claim and construct the scene.",
    );
  }

  async claimNextSession(botName: string): Promise<SessionState | null> {
    const next = await this.sessionService.findNextQueuedSession();
    if (!next) {
      return null;
    }

    const claimed = await this.sessionService.updateSession(next.id, {
      status: "building_scene",
      claimedBy: botName,
      lastHeartbeatAt: new Date().toISOString(),
    });

    await this.publishEvent(claimed.id, {
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status: "building_scene",
        message: `${botName} claimed the session and is preparing the historical scene.`,
      },
    });

    this.emit("session_claimed", claimed);
    return claimed;
  }

  async updateStatus(
    sessionId: string,
    status: SessionStatus,
    message: string,
    patch: Partial<Omit<SessionState, "id" | "createdAt">> = {},
  ): Promise<SessionState> {
    const updated = await this.sessionService.updateSession(sessionId, {
      ...patch,
      status,
    });

    await this.publishEvent(sessionId, {
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status,
        message,
      },
    });

    return updated;
  }

  async publishBuildPlan(sessionId: string, buildPlan: BuildPlan): Promise<SessionState> {
    const updated = await this.sessionService.saveBuildPlan(sessionId, buildPlan);
    await this.publishEvent(sessionId, {
      type: "build_plan_ready",
      timestamp: new Date().toISOString(),
      data: { buildPlan },
    });
    return updated;
  }

  async publishBuildProgress(sessionId: string, buildProgress: BuildProgress): Promise<SessionState> {
    const updated = await this.sessionService.updateSession(sessionId, {
      buildProgress,
      lastHeartbeatAt: new Date().toISOString(),
    });

    await this.publishEvent(sessionId, {
      type: "build_progress",
      timestamp: new Date().toISOString(),
      data: buildProgress,
    });

    return updated;
  }

  async addChatMessage(sessionId: string, chatMessage: ChatMessage): Promise<SessionState> {
    const updated = await this.sessionService.pushChatMessage(sessionId, chatMessage);
    await this.publishEvent(sessionId, {
      type: "chat",
      timestamp: chatMessage.timestamp,
      data: chatMessage,
    });
    return updated;
  }

  async completeSession(sessionId: string, summary: SessionSummary): Promise<SessionState> {
    const updated = await this.sessionService.updateSession(sessionId, {
      status: "completed",
      summary,
      lastHeartbeatAt: new Date().toISOString(),
    });

    await this.publishEvent(sessionId, {
      type: "session_complete",
      timestamp: new Date().toISOString(),
      data: summary,
    });

    await this.publishEvent(sessionId, {
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status: "completed",
        message: "Session complete. Assessment summary is ready.",
      },
    });

    return updated;
  }

  async failSession(sessionId: string, message: string): Promise<SessionState> {
    const updated = await this.sessionService.updateSession(sessionId, {
      status: "error",
      errorMessage: message,
      lastHeartbeatAt: new Date().toISOString(),
    });

    await this.publishEvent(sessionId, {
      type: "error",
      timestamp: new Date().toISOString(),
      data: { message },
    });

    await this.publishEvent(sessionId, {
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status: "error",
        message,
      },
    });

    return updated;
  }

  async publishEvent(sessionId: string, event: SSEEvent): Promise<void> {
    await this.eventBuffer.publish(sessionId, event);
    this.emit("event", { sessionId, event });
  }
}
