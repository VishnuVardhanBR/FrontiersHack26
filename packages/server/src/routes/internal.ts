import {
  BuildPlanSchema,
  BuildProgressSchema,
  ChatMessageSchema,
  QuestionAttemptSchema,
  SessionSummarySchema,
  SessionStatusSchema,
} from "@quizcraft/shared";
import { Router } from "express";
import { z } from "zod";

import { botBridgeService, sessionService } from "../services/app-services.js";

const BotSessionPatchSchema = z.object({
  title: z.string().min(1).optional(),
  currentRegionId: z.string().min(1).nullable().optional(),
  activeQuestionIndex: z.number().int().nonnegative().optional(),
  objectiveFound: z.boolean().optional(),
  questionAttempts: z.array(QuestionAttemptSchema).optional(),
  claimedBy: z.string().min(1).nullable().optional(),
  lastHeartbeatAt: z.string().datetime().nullable().optional(),
  errorMessage: z.string().min(1).nullable().optional(),
});

const BotUpdateSchema = z.object({
  status: SessionStatusSchema.optional(),
  statusMessage: z.string().min(1).optional(),
  patch: BotSessionPatchSchema.optional(),
  buildPlan: BuildPlanSchema.optional(),
  buildProgress: BuildProgressSchema.optional(),
  chatMessage: ChatMessageSchema.optional(),
  summary: SessionSummarySchema.optional(),
});

export const internalRouter = Router();

internalRouter.get("/bot/next-session", async (req, res, next) => {
  try {
    const botName = typeof req.query.botName === "string" && req.query.botName
      ? req.query.botName
      : "QuizCraftTutor";
    const session = await botBridgeService.claimNextSession(botName);

    if (!session) {
      res.status(204).end();
      return;
    }

    res.json({ session });
  } catch (error) {
    next(error);
  }
});

internalRouter.post("/bot/sessions/:id/update", async (req, res, next) => {
  try {
    const body = BotUpdateSchema.parse(req.body);
    const sessionId = req.params.id;

    if (body.patch) {
      await sessionService.updateSession(sessionId, body.patch);
    }

    if (body.buildPlan) {
      await botBridgeService.publishBuildPlan(sessionId, body.buildPlan);
    }

    if (body.buildProgress) {
      await botBridgeService.publishBuildProgress(sessionId, body.buildProgress);
    }

    if (body.chatMessage) {
      await botBridgeService.addChatMessage(sessionId, body.chatMessage);
    }

    if (body.summary) {
      await botBridgeService.completeSession(sessionId, body.summary);
    } else if (body.status && body.statusMessage) {
      await botBridgeService.updateStatus(sessionId, body.status, body.statusMessage, body.patch ?? {});
    } else if (body.status === "error") {
      await botBridgeService.failSession(
        sessionId,
        body.statusMessage ?? body.patch?.errorMessage ?? "The tutor bot reported an unexpected error.",
      );
    }

    const session = await sessionService.getSession(sessionId);
    res.json({ session });
  } catch (error) {
    next(error);
  }
});
