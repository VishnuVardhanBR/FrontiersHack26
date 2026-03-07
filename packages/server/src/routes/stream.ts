import { Router } from "express";

import { eventBuffer, sessionService } from "../services/app-services.js";

const writeEvent = (res: Parameters<Router["get"]>[1], event: unknown) => {
  (res as unknown as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(event)}\n\n`);
};

export const streamRouter = Router();

streamRouter.get("/:id/stream", async (req, res, next) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const recentEvents = await eventBuffer.getRecentEvents(session.id);
    for (const event of recentEvents) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const unsubscribe = await eventBuffer.subscribe(session.id, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
      res.end();
    });
  } catch (error) {
    next(error);
  }
});
