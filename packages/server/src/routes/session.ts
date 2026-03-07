import { Router } from "express";

import { botBridgeService, sessionService } from "../services/app-services.js";
import { log } from "../log.js";

export const sessionRouter = Router();

sessionRouter.get("/:id", async (req, res, next) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    res.json({ session });
  } catch (error) {
    next(error);
  }
});

sessionRouter.post("/:id/start", async (req, res, next) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    if (session.status !== "planned") {
      res.status(409).json({ error: `Cannot start a session with status "${session.status}".` });
      return;
    }

    log("session", `teacher started build for ${req.params.id} — "${session.title}"`);
    const started = await botBridgeService.startSession(req.params.id);
    res.json({ session: started });
  } catch (error) {
    next(error);
  }
});
