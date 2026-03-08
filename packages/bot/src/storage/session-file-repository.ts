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

  private getExperiencePath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), "experience-package.json");
  }

  private getClaimLockPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), ".claim.lock");
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
    const now = new Date().toISOString();
    const current = await this.readRawSession(session.id);
    const canonicalExperience = await this.readCanonicalExperience(session.id);
    const questionAttempts = session.summary
      ? session.summary.questionBreakdown.map((question) => ({
          questionId: question.questionId,
          attempts: question.attempts,
          hintsUsed: question.hintsUsed,
          correct: question.answeredCorrectly,
          lastAnswer: question.answer,
        }))
      : Array.isArray(current?.questionAttempts)
        ? current.questionAttempts
        : [];

    const payload = withTimestamp({
      ...(current ?? {}),
      id: session.id,
      title:
        typeof current?.title === "string"
          ? current.title
          : session.experiencePackage.title,
      sourceFileName:
        typeof current?.sourceFileName === "string"
          ? current.sourceFileName
          : "source.txt",
      sourceFileType:
        typeof current?.sourceFileType === "string"
          ? current.sourceFileType
          : "txt",
      teacherOptions:
        current?.teacherOptions
        ?? session.teacherSettings
        ?? {
          gradeLevel: "6-8",
          topic: session.experiencePackage.title,
          questionCount: Math.max(3, session.experiencePackage.questionPlan.length || 3),
          objectiveEmphasis: "guided-tour",
        },
      sourceTextPath:
        typeof current?.sourceTextPath === "string"
          ? current.sourceTextPath
          : path.join(dir, "source.txt"),
      experiencePackage: canonicalExperience ?? current?.experiencePackage ?? null,
      buildPlan: current?.buildPlan ?? null,
      buildProgress:
        session.buildProgress
        ?? current?.buildProgress
        ?? {
          completedCommands: 0,
          totalCommands: 0,
          percent: 0,
          currentStep: "Waiting to build",
        },
      currentRegionId: session.runtime?.activeRegionId ?? current?.currentRegionId ?? null,
      activeQuestionIndex: current?.activeQuestionIndex ?? 0,
      objectiveFound: session.runtime?.itemFound ?? current?.objectiveFound ?? false,
      questionAttempts,
      chatLog: session.chatLog ?? current?.chatLog ?? [],
      summary: session.summary
        ? {
            score: session.summary.scorePercent,
            correctAnswers: session.summary.answeredCorrectly,
            totalQuestions: session.summary.totalQuestions,
            totalHintsUsed: session.summary.totalHintsUsed,
            totalDurationSeconds: Math.round(session.summary.durationMs / 1000),
            questionBreakdown: questionAttempts,
            recap: session.summary.strengths[0] ?? "Session complete.",
          }
        : current?.summary ?? null,
      errorMessage:
        session.status === "error"
          ? typeof current?.errorMessage === "string"
            ? current.errorMessage
            : typeof session.errorMessage === "string" && session.errorMessage.trim().length > 0
              ? session.errorMessage
              : "The tutor bot reported an unexpected error."
          : null,
      claimedBy: session.claimedBy ?? current?.claimedBy ?? null,
      lastHeartbeatAt: now,
      botBuildPlan: session.buildPlan ?? current?.botBuildPlan ?? null,
      buildSummary: session.buildSummary ?? current?.buildSummary ?? null,
      runtime: session.runtime ?? current?.runtime ?? {},
      botSummary: session.summary ?? current?.botSummary ?? null,
      createdAt:
        typeof current?.createdAt === "string"
          ? current.createdAt
          : session.createdAt ?? now,
      claimedAt:
        typeof current?.claimedAt === "string"
          ? current.claimedAt
          : session.claimedAt,
      status: session.status,
    });

    await fs.writeFile(this.getSessionPath(session.id), JSON.stringify(payload, null, 2));
  }

  async appendEvent(event: SessionEvent): Promise<void> {
    const dir = this.getSessionDir(event.sessionId);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(this.getEventsPath(event.sessionId), `${JSON.stringify(this.toSharedEvent(event))}\n`);
  }

  async listAvailableSessions(
    botUsername: string,
    _options: { allowResumeIncomplete?: boolean } = {},
  ): Promise<SessionState[]> {
    const ids = await this.listSessionIds();
    const sessions = await Promise.all(ids.map((id) => this.load(id)));

    // Staleness windows:
    // "queued"       — teacher pressed Start Build; valid for 30 min in case the
    //                  bot was briefly down when they clicked.
    // NOTE: resume pickup is intentionally disabled until the lifecycle is
    // fully reliable end-to-end.
    const QUEUED_GRACE_MS     = 30 * 60 * 1000;
    const now = Date.now();

    const ageMs = (session: SessionState): number => {
      const lastActive = Date.parse(session.updatedAt ?? session.createdAt ?? "");
      return Number.isFinite(lastActive) ? now - lastActive : Infinity;
    };

    return sessions
      .filter((session): session is SessionState => Boolean(session))
      .filter((session) => {
        if (session.summary) return false;
        if (session.claimedBy && session.claimedBy !== botUsername) return false;

        if (session.status !== "queued") {
          return false;
        }
        return ageMs(session) < QUEUED_GRACE_MS;
      })
      .sort((left, right) => {
        const leftAt = Date.parse(left.updatedAt ?? left.createdAt ?? "");
        const rightAt = Date.parse(right.updatedAt ?? right.createdAt ?? "");
        return rightAt - leftAt;
      });
  }

  async claim(sessionId: string, botUsername: string): Promise<SessionState | null> {
    return this.withClaimLock(sessionId, async () => {
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
    });
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

  private async readCanonicalExperience(sessionId: string): Promise<Record<string, unknown> | null> {
    try {
      const raw = await fs.readFile(this.getExperiencePath(sessionId), "utf8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  private async readRawSession(sessionId: string): Promise<Record<string, any> | null> {
    try {
      const raw = await fs.readFile(this.getSessionPath(sessionId), "utf8");
      return JSON.parse(raw) as Record<string, any>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  private async withClaimLock<T>(sessionId: string, task: () => Promise<T>): Promise<T | null> {
    const lockPath = this.getClaimLockPath(sessionId);
    await fs.mkdir(this.getSessionDir(sessionId), { recursive: true });

    let lockHandle: Awaited<ReturnType<typeof fs.open>> | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        lockHandle = await fs.open(lockPath, "wx");
        break;
      } catch (error) {
        const errno = (error as NodeJS.ErrnoException).code;
        if (errno !== "EEXIST") {
          throw error;
        }

        if (attempt === 0) {
          try {
            const stats = await fs.stat(lockPath);
            const ageMs = Date.now() - stats.mtimeMs;
            if (ageMs > 45_000) {
              await fs.unlink(lockPath);
              continue;
            }
          } catch (statError) {
            if ((statError as NodeJS.ErrnoException).code !== "ENOENT") {
              throw statError;
            }
            continue;
          }
        }
        return null;
      }
    }

    if (!lockHandle) {
      return null;
    }

    try {
      return await task();
    } finally {
      await lockHandle.close().catch(() => undefined);
      await fs.unlink(lockPath).catch(() => undefined);
    }
  }
}
