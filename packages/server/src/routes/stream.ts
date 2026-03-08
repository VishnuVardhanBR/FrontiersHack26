import type { Response } from "express";
import { Router } from "express";

import { sessionService } from "../services/app-services.js";
import { validateSessionIdParam } from "./session-id.middleware.js";

const writeEvent = (
  res: Response,
  event: { type?: string } & Record<string, unknown>,
) => {
  const chunks = [];
  if (typeof event.type === "string" && event.type.trim()) {
    chunks.push(`event: ${event.type}`);
  }
  chunks.push(`data: ${JSON.stringify(event)}`);
  (res as unknown as { write: (chunk: string) => void }).write(`${chunks.join("\n")}\n\n`);
};

export const streamRouter = Router();

streamRouter.get("/:id/stream", validateSessionIdParam, async (req, res, next) => {
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

    let deliveredCount = 0;

    const recentEvents = await sessionService.readEvents(session.id);
    for (const event of recentEvents) {
      writeEvent(res, event as unknown as { type?: string } & Record<string, unknown>);
      deliveredCount += 1;
    }

    const keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 15000);

    const poll = setInterval(async () => {
      try {
        const events = await sessionService.readEvents(session.id);
        if (events.length <= deliveredCount) {
          return;
        }

        for (const event of events.slice(deliveredCount)) {
          writeEvent(res, event as unknown as { type?: string } & Record<string, unknown>);
          deliveredCount += 1;
        }
      } catch {
        clearInterval(poll);
        clearInterval(keepAlive);
        res.end();
      }
    }, 1000);

    req.on("close", () => {
      clearInterval(poll);
      clearInterval(keepAlive);
      res.end();
    });
  } catch (error) {
    next(error);
  }
});
