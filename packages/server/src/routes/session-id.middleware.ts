import type { RequestHandler } from "express";

import { formatZodIssues } from "../http/errors.js";
import { SessionIdSchema } from "../http/session-id.js";

export const validateSessionIdParam: RequestHandler<{ id: string }> = (req, res, next) => {
  const parsed = SessionIdSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid session id.",
      issues: formatZodIssues(parsed.error),
    });
    return;
  }

  req.params.id = parsed.data;
  next();
};
