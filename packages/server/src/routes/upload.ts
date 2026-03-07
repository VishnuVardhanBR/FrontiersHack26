import { TeacherOptionsSchema } from "@quizcraft/shared";
import { Router } from "express";
import { z } from "zod";

import { GeminiRequestError } from "../gemini/client.js";
import {
  botBridgeService,
  experiencePlannerService,
  sessionService,
} from "../services/app-services.js";

const parseTeacherOptions = (body: Record<string, unknown>) =>
  TeacherOptionsSchema.parse({
    gradeLevel:
      typeof body.gradeLevel === "string" && body.gradeLevel
        ? body.gradeLevel
        : typeof body.gradeBand === "string" && body.gradeBand
          ? body.gradeBand
          : undefined,
    topic: typeof body.topic === "string" && body.topic ? body.topic : undefined,
    questionCount:
      typeof body.questionCount === "string" || typeof body.questionCount === "number"
        ? Number(body.questionCount)
        : undefined,
    objectiveEmphasis:
      typeof body.objectiveEmphasis === "string" && body.objectiveEmphasis
        ? body.objectiveEmphasis
        : undefined,
  });

const CreateLessonSchema = z.object({
  chapterText: z.string().trim().min(1, "Chapter text is required."),
}).passthrough();

export const uploadRouter = Router();

uploadRouter.post("/", async (req, res, next) => {
  let sessionId: string | null = null;

  try {
    const body = CreateLessonSchema.parse(req.body as Record<string, unknown>);
    const teacherOptions = parseTeacherOptions(req.body as Record<string, unknown>);

    const session = await sessionService.createSession({
      sourceFileName: "pasted-chapter.txt",
      sourceFileType: "text",
      teacherOptions,
    });
    sessionId = session.id;

    await botBridgeService.publishEvent(session.id, {
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status: "planning",
        message: "Chapter received. Planning the Minecraft lesson.",
      },
    });

    await sessionService.saveSourceText(session.id, body.chapterText);

    const experiencePackage = await experiencePlannerService.planExperience({
      sessionId: session.id,
      chapterText: body.chapterText,
      teacherOptions,
    });

    await sessionService.saveExperiencePackage(session.id, experiencePackage);
    await botBridgeService.publishEvent(session.id, {
      type: "experience_ready",
      timestamp: new Date().toISOString(),
      data: {
        experiencePackage,
      },
    });

    const queuedSession = await botBridgeService.queueSession(session.id);

    res.status(201).json({
      sessionId: queuedSession.id,
      session: queuedSession,
    });
  } catch (error) {
    if (sessionId) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      await botBridgeService.failSession(sessionId, message);
    }

    if (error instanceof GeminiRequestError) {
      const statusCode = error.kind === "timeout" ? 504 : error.kind === "quota" ? 503 : 502;
      res.status(statusCode).json({
        error: error.message,
        sessionId,
      });
      return;
    }

    next(error);
  }
});
