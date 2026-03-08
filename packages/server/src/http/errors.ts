import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";

interface ErrorLike {
  body?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
}

export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
}

export const formatZodIssues = (error: ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.length > 0 ? issue.path.join(".") : "body",
  }));

const isMalformedJsonBodyError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as ErrorLike;
  return candidate.type === "entity.parse.failed"
    || (candidate.status === 400 && Object.prototype.hasOwnProperty.call(candidate, "body"));
};

const extractStatusCode = (error: unknown): number | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  const candidate = error as ErrorLike;
  if (typeof candidate.statusCode === "number") {
    return candidate.statusCode;
  }
  if (typeof candidate.status === "number") {
    return candidate.status;
  }
  return null;
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Request validation failed.",
      issues: formatZodIssues(error),
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const isFileSizeLimit = error.code === "LIMIT_FILE_SIZE";
    res.status(isFileSizeLimit ? 413 : 400).json({
      error: isFileSizeLimit
        ? "Uploaded file exceeds the size limit."
        : error.message || "Invalid upload request.",
      code: error.code,
    });
    return;
  }

  if (isMalformedJsonBodyError(error)) {
    res.status(400).json({
      error: "Malformed JSON body.",
    });
    return;
  }

  const statusCode = extractStatusCode(error);
  if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
    const message = error instanceof Error && error.message ? error.message : "Bad request.";
    res.status(statusCode).json({ error: message });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  res.status(500).json({ error: message });
};
