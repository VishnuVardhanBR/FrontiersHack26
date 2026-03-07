import { promises as fs } from "node:fs";
import path from "node:path";

import {
  BuildPlanSchema,
  SSEEventSchema,
  SessionStatusSchema,
  SessionStateSchema,
  type BuildPlan,
  type ExperiencePackage,
  type SSEEvent,
  type SessionState,
  type TeacherOptions,
} from "@quizcraft/shared";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

/** Permissive schema for reading session.json that the bot may have overwritten (different shape). */
const SessionStateFileSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional().default("Untitled QuizCraft Session"),
  sourceFileName: z.string().optional().default("session.txt"),
  sourceFileType: z.string().optional().default("txt"),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  updatedAt: z.string().optional().default(() => new Date().toISOString()),
  status: SessionStatusSchema.optional().default("queued"),
  teacherOptions: z.record(z.unknown()).optional().default({}),
  sourceTextPath: z.string().optional(),
  experiencePackage: z.unknown().nullable().optional().default(null),
  buildPlan: z.unknown().nullable().optional().default(null),
  buildProgress: z.record(z.unknown()).optional().default({}),
  currentRegionId: z.string().nullable().optional().default(null),
  activeQuestionIndex: z.number().optional().default(0),
  objectiveFound: z.boolean().optional().default(false),
  questionAttempts: z.array(z.unknown()).optional().default([]),
  chatLog: z.array(z.unknown()).optional().default([]),
  summary: z.unknown().nullable().optional().default(null),
  errorMessage: z.string().nullable().optional().default(null),
  claimedBy: z.string().nullable().optional().default(null),
  lastHeartbeatAt: z.string().nullable().optional().default(null),
});

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
      const data = JSON.parse(raw) as Record<string, unknown>;
      try {
        return SessionStateSchema.parse(data) as SessionState;
      } catch {
        const parsed = SessionStateFileSchema.parse(data);
        return {
          ...parsed,
          teacherOptions:
            parsed.teacherOptions && typeof parsed.teacherOptions === "object" && "topic" in parsed.teacherOptions
              ? (parsed.teacherOptions as TeacherOptions)
              : { topic: parsed.title ?? "Session", gradeLevel: "6-8", questionCount: 4, objectiveEmphasis: "artifact hunt" },
          experiencePackage: parsed.experiencePackage as SessionState["experiencePackage"],
          buildPlan: parsed.buildPlan as SessionState["buildPlan"],
          buildProgress:
            typeof parsed.buildProgress === "object" && parsed.buildProgress && "percent" in parsed.buildProgress
              ? (parsed.buildProgress as SessionState["buildProgress"])
              : {},
          questionAttempts: Array.isArray(parsed.questionAttempts) ? (parsed.questionAttempts as SessionState["questionAttempts"]) : [],
          chatLog: Array.isArray(parsed.chatLog) ? (parsed.chatLog as SessionState["chatLog"]) : [],
        } as SessionState;
      }
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

    const merged = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    let updated: SessionState;
    try {
      updated = SessionStateSchema.parse(merged) as SessionState;
    } catch {
      updated = merged as SessionState;
    }

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
        .map((entry) => this.getSession(entry.name)),
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
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}
