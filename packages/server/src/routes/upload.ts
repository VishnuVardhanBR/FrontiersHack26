import path from "node:path";

import { TeacherOptionsSchema } from "@quizcraft/shared";
import { Router } from "express";
import multer from "multer";

import { config } from "../config.js";
import { GeminiRequestError } from "../gemini/client.js";
import {
  botBridgeService,
  documentExtractorService,
  experiencePlannerService,
  sessionService,
} from "../services/app-services.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadSizeBytes,
  },
});

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

export const uploadRouter = Router();

uploadRouter.post("/", upload.single("file"), async (req, res, next) => {
  let sessionId: string | null = null;

  try {
    if (!req.file) {
      res.status(400).json({ error: "A chapter file is required." });
      return;
    }

    const teacherOptions = parseTeacherOptions(req.body as Record<string, unknown>);
    const sourceFileType = path.extname(req.file.originalname).replace(".", "") || "txt";

    const session = await sessionService.createSession({
      sourceFileName: req.file.originalname,
      sourceFileType,
      teacherOptions,
    });
    sessionId = session.id;

    await botBridgeService.publishEvent(session.id, {
      type: "status",
      timestamp: new Date().toISOString(),
      data: {
        status: "planning",
        message: "Upload received. Extracting the chapter and planning the Minecraft lesson.",
      },
    });

    const extractedText = (await documentExtractorService.extractText(req.file)).trim();
    if (!extractedText) {
      const message = "No readable text could be extracted from the uploaded file.";
      await botBridgeService.failSession(session.id, message);
      res.status(422).json({
        error: message,
        sessionId: session.id,
      });
      return;
    }

    await sessionService.saveSourceText(session.id, extractedText);

    const experiencePackage = await experiencePlannerService.planExperience({
      sessionId: session.id,
      chapterText: extractedText,
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
