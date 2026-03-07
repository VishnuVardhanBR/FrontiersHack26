import { Router } from "express";

import { sessionService } from "../services/app-services.js";

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
