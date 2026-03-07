import { Router } from "express";

import { AQUA_ROMA_EXPERIENCE } from "@quizcraft/shared";

import { botBridgeService, sessionService } from "../services/app-services.js";

export const demoRouter = Router();

demoRouter.post("/aqua-roma", async (req, res, next) => {
  try {
    const session = await sessionService.createSession({
      sourceFileName: "Aqua Roma Demo.txt",
      sourceFileType: "txt",
      teacherOptions: {
        topic: "Aqua Roma",
        gradeLevel: "6-8",
        questionCount: 4,
        objectiveEmphasis: "guided-tour",
      },
    });

    await sessionService.saveExperiencePackage(session.id, AQUA_ROMA_EXPERIENCE);

    await sessionService.saveSourceText(
      session.id,
      "Roman aqueducts moved water using gravity. Arches supported the channel; the system served cities.",
    );

    await botBridgeService.publishEvent(session.id, {
      type: "experience_ready",
      timestamp: new Date().toISOString(),
      data: { experiencePackage: AQUA_ROMA_EXPERIENCE },
    });

    const queued = await botBridgeService.queueSession(session.id);

    res.status(201).json({
      sessionId: queued.id,
      session: queued,
    });
  } catch (error) {
    next(error);
  }
});
