import { promises as fs } from "node:fs";
import path from "node:path";

import {
  BuildPlanSchema,
  SSEEventSchema,
  SessionStateSchema,
  type BuildPlan,
  type ExperiencePackage,
  type SSEEvent,
  type SessionState,
  type TeacherOptions,
} from "@quizcraft/shared";
import { v4 as uuidv4 } from "uuid";

export interface CreateSessionInput {
  sourceFileName: string;
  sourceFileType: string;
  teacherOptions: TeacherOptions;
}

const SESSION_FILE_NAME = "session.json";
const EXPERIENCE_FILE_NAME = "experience-package.json";
const BUILD_PLAN_FILE_NAME = "build-plan.json";
const EVENTS_FILE_NAME = "events.ndjson";
const SOURCE_FILE_NAME = "source.txt";

export class SessionService {
  constructor(private readonly baseDir: string) {}

  private async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  private sessionDir(sessionId: string): string {
    return path.join(this.baseDir, sessionId);
  }

  private sessionFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), SESSION_FILE_NAME);
  }

  private experienceFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), EXPERIENCE_FILE_NAME);
  }

  private buildPlanFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), BUILD_PLAN_FILE_NAME);
  }

  private eventsFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), EVENTS_FILE_NAME);
  }

  private sourceFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), SOURCE_FILE_NAME);
  }

  async createSession(input: CreateSessionInput): Promise<SessionState> {
    await this.ensureBaseDir();
    const sessionId = uuidv4();
    await fs.mkdir(this.sessionDir(sessionId), { recursive: true });

    const now = new Date().toISOString();
    const session = SessionStateSchema.parse({
      id: sessionId,
      title: `${input.teacherOptions.topic} Session`,
      sourceFileName: input.sourceFileName,
      sourceFileType: input.sourceFileType,
      createdAt: now,
      updatedAt: now,
      status: "planning",
      teacherOptions: input.teacherOptions,
      sourceTextPath: this.sourceFile(sessionId),
    });

    await this.writeJson(this.sessionFile(sessionId), session);
    await fs.writeFile(this.eventsFile(sessionId), "", "utf8");
    return session;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    try {
      const raw = await fs.readFile(this.sessionFile(sessionId), "utf8");
      return SessionStateSchema.parse(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async updateSession(
    sessionId: string,
    patch: Partial<Omit<SessionState, "id" | "createdAt">>,
  ): Promise<SessionState> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    const updated = SessionStateSchema.parse({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });

    await this.writeJson(this.sessionFile(sessionId), updated);
    return updated;
  }

  async saveSourceText(sessionId: string, text: string): Promise<void> {
    await fs.writeFile(this.sourceFile(sessionId), text, "utf8");
  }

  async getSourceText(sessionId: string): Promise<string> {
    return fs.readFile(this.sourceFile(sessionId), "utf8");
  }

  async saveExperiencePackage(sessionId: string, experiencePackage: ExperiencePackage): Promise<SessionState> {
    await this.writeJson(this.experienceFile(sessionId), experiencePackage);
    return this.updateSession(sessionId, {
      title: experiencePackage.title,
      experiencePackage,
    });
  }

  async saveBuildPlan(sessionId: string, buildPlan: BuildPlan): Promise<SessionState> {
    await this.writeJson(this.buildPlanFile(sessionId), buildPlan);
    return this.updateSession(sessionId, { buildPlan });
  }

  async appendEvent(sessionId: string, event: SSEEvent): Promise<void> {
    const validated = SSEEventSchema.parse(event);
    await fs.appendFile(this.eventsFile(sessionId), `${JSON.stringify(validated)}\n`, "utf8");
  }

  async readEvents(sessionId: string): Promise<SSEEvent[]> {
    try {
      const raw = await fs.readFile(this.eventsFile(sessionId), "utf8");
      return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => SSEEventSchema.parse(JSON.parse(line)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async listSessions(): Promise<SessionState[]> {
    await this.ensureBaseDir();
    const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
    const sessions = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            return await this.getSession(entry.name);
          } catch (error) {
            console.warn(
              `[sessions] skipping unreadable session ${entry.name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return null;
          }
        }),
    );

    return sessions.filter((session): session is SessionState => session !== null);
  }

  async findNextQueuedSession(): Promise<SessionState | null> {
    const sessions = await this.listSessions();
    return sessions
      .filter((session) => session.status === "queued")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] ?? null;
  }

  async pushChatMessage(sessionId: string, message: SessionState["chatLog"][number]): Promise<SessionState> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    return this.updateSession(sessionId, {
      chatLog: [...session.chatLog, message],
    });
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, filePath);
  }
}
