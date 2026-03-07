import { Router } from "express";

import { serverResetService } from "../services/app-services.js";

export const adminRouter = Router();

adminRouter.post("/reset", async (_req, res, next) => {
  try {
    await serverResetService.resetForNewLesson();
    res.json({
      ok: true,
      message: "Minecraft server reset. Start a new lesson from the setup screen.",
      restartedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
