import { LIBRARY_ALEXANDRIA_EXPERIENCE } from "@quizcraft/shared";
import { Router } from "express";

import { botBridgeService, sessionService } from "../services/app-services.js";

export const demoRouter = Router();

demoRouter.post("/aqua-roma", (_req, res) => {
  res.status(410).json({
    error: "Aqua Roma demo removed. Use Library of Alexandria demo when available.",
  });
});

demoRouter.post("/library-alexandria", async (req, res, next) => {
  try {
    const session = await sessionService.createSession({
      sourceFileName: "library-alexandria-demo.txt",
      sourceFileType: "txt",
      teacherOptions: {
        gradeLevel: "6-8",
        topic: "History",
        questionCount: 4,
        objectiveEmphasis: "artifact hunt",
      },
    });

    await sessionService.saveSourceText(session.id, LIBRARY_ALEXANDRIA_EXPERIENCE.sourceExcerpt);
    await sessionService.saveExperiencePackage(session.id, LIBRARY_ALEXANDRIA_EXPERIENCE);

    await botBridgeService.publishEvent(session.id, {
      type: "experience_ready",
      timestamp: new Date().toISOString(),
      data: { experiencePackage: LIBRARY_ALEXANDRIA_EXPERIENCE },
    });

    const queuedSession = await botBridgeService.queueSession(session.id);

    res.status(201).json({
      sessionId: queuedSession.id,
      session: queuedSession,
    });
  } catch (error) {
    next(error);
  }
});
